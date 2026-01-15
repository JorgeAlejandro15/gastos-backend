# Revisión del Sistema de Invitaciones al Hogar

## Análisis del Problema Actual

### Situación Detectada

Un usuario intentó invitar a otro por email, pero el invitado ya se había registrado usando **teléfono (phone)** sin email. Esto causa las siguientes **inconsistencias**:

1. **La invitación se crea con email** ([households.service.ts#L325-L355](households.service.ts))

   ```typescript
   async inviteByEmail(inviterUserId: string, email: string) {
     // Crea invitación solo con email
     const normalizedEmail = this.normalizeEmail(email);
     // ... guarda con email normalizado
   }
   ```

2. **Auto-aceptación solo funciona con email** ([auth.service.ts#L158-L162](auth.service.ts))

   ```typescript
   const household = email
     ? await this.households.acceptInvitationForUserByEmail(
         email,
         user.id,
         manager,
       )
     : null;
   ```

   - Si el usuario se registra con **phone**, no hay auto-aceptación
   - La invitación queda pendiente sin conexión al usuario

3. **Las instrucciones asumen registro con email** ([ListShareModal.tsx#L64-L69](ListShareModal.tsx))

   ```typescript
   `2) Regístrate con este mismo email: ${lastInvite.email}\n`;
   ```

   - Si el usuario ya existe con phone, estas instrucciones son **incorrectas**
   - No hay forma de vincular la invitación al usuario existente

4. **El teléfono está encriptado en BD** ([user.entity.ts#L21-L24](user.entity.ts))
   - No se puede buscar usuarios por phone desde el frontend
   - No se puede validar si el phone ya está registrado

### Flujos Problemáticos

#### Escenario 1: Usuario existe con phone, invitación por email

```
1. Usuario A invita a "amigo@email.com"
2. Usuario amigo YA existe con phone="+123456789" (sin email)
3. Las instrucciones dicen "regístrate con amigo@email.com"
4. Al intentar registro con ese email → éxito, PERO es una CUENTA NUEVA
5. Ahora hay DOS cuentas para la misma persona física
```

#### Escenario 2: Usuario se registra con phone, no puede aceptar invitación por email

```
1. Usuario A invita a "amigo@email.com"
2. Usuario amigo se registra con phone="+123456789" (sin email)
3. Auto-aceptación no ocurre (solo funciona con email)
4. Usuario amigo debe usar "Unirme con código"
5. Pero las instrucciones son confusas
```

---

## Arquitectura Actual

### Backend: Modelo de Invitaciones

```typescript
// household-invitation.entity.ts
{
  id: uuid,
  householdId: uuid,
  email: string,              // ⚠️ Solo email, no phone
  tokenHash: string,          // Token SHA-256 para accept manual
  status: 'pending' | 'accepted' | 'revoked',
  invitedById: uuid,
  expiresAt: timestamp?,
  acceptedAt: timestamp?,
  acceptedById: uuid?
}
```

### Frontend: Flujo de Invitación

```
ListShareModal → inviteByEmail({ email }) → Backend crea token
              → Muestra instrucciones con email + token
              → Usuario comparte via WhatsApp/Telegram
```

---

## Recomendaciones de Mejora

### Opción A: **Sistema Dual de Invitación** (Recomendada ⭐)

#### Cambios en Backend

1. **Ampliar tabla de invitaciones**

   ```typescript
   // Migración
   ALTER TABLE household_invitations
     ADD COLUMN phone_lookup_hash VARCHAR(64),
     ADD COLUMN invited_identifier VARCHAR(320); // email o phone normalizado

   // Índice único parcial para phone
   CREATE UNIQUE INDEX uq_household_inv_phone
     ON household_invitations(household_id, phone_lookup_hash, status)
     WHERE status = 'pending' AND phone_lookup_hash IS NOT NULL;
   ```

2. **Nuevo endpoint: Buscar usuarios**

   ```typescript
   // households.controller.ts
   @Post('search-user')
   searchUserForInvite(
     @CurrentUser() user: CurrentUser,
     @Body() dto: { identifier: string } // email o phone
   ) {
     return this.households.searchUserForInvite(user.userId, dto.identifier);
   }
   ```

   ```typescript
   // households.service.ts
   async searchUserForInvite(ownerUserId: string, identifier: string) {
     // 1. Validar que el owner tiene hogar
     const household = await this.getHouseholdForUser(ownerUserId);
     if (!household) throw new NotFoundException('Household not found');

     // 2. Detectar si es email o phone
     const isEmail = identifier.includes('@');

     if (isEmail) {
       const user = await this.users.findByEmail(identifier);
       return {
         exists: !!user,
         isAlreadyMember: user ? await this.isUserInHousehold(household.id, user.id) : false,
         canInvite: !!user && !(await this.isUserInHousehold(household.id, user.id)),
         displayName: user?.displayName,
         method: 'email'
       };
     } else {
       const user = await this.users.findByPhone(identifier);
       return {
         exists: !!user,
         isAlreadyMember: user ? await this.isUserInHousehold(household.id, user.id) : false,
         canInvite: !!user && !(await this.isUserInHousehold(household.id, user.id)),
         displayName: user?.displayName,
         method: 'phone'
       };
     }
   }
   ```

3. **Modificar inviteByEmail para soportar phone**

   ```typescript
   async invite(
     inviterUserId: string,
     input: { email?: string; phone?: string }
   ) {
     const email = input.email ? this.normalizeEmail(input.email) : null;
     const phone = input.phone ? String(input.phone).trim() : null;

     if (!email && !phone) {
       throw new ConflictException('Email or phone required');
     }

     const household = await this.getHouseholdForUser(inviterUserId);
     if (!household) throw new NotFoundException('Household not found');

     const token = randomBytes(32).toString('base64url');
     const tokenHash = this.hashToken(token);

     const phoneLookupHash = phone
       ? this.users.computePhoneLookupHash(phone)
       : null;

     const invitation = await this.invitationsRepo.save(
       this.invitationsRepo.create({
         householdId: household.id,
         email: email,
         phoneLookupHash: phoneLookupHash,
         invitedIdentifier: email || phone,
         tokenHash,
         status: 'pending',
         invitedById: inviterUserId,
       })
     );

     return {
       ok: true,
       invitationId: invitation.id,
       token,
       email: email,
       phone: phone,
       method: email ? 'email' : 'phone'
     };
   }
   ```

4. **Auto-aceptación en registro para ambos métodos**
   ```typescript
   // auth.service.ts - en register()
   const household = email
     ? await this.households.acceptInvitationForUserByEmail(
         email,
         user.id,
         manager,
       )
     : phone
       ? await this.households.acceptInvitationForUserByPhone(
           phone,
           user.id,
           manager,
         )
       : null;
   ```

#### Cambios en Frontend

1. **Nuevo componente: Selector de método**

   ```typescript
   // ListShareModal.tsx
   const [inviteMethod, setInviteMethod] = useState<'email' | 'phone'>('email');
   const [inviteIdentifier, setInviteIdentifier] = useState('');
   const [searchResult, setSearchResult] = useState<SearchUserResult | null>(null);

   // Buscar usuario antes de invitar
   const onSearchUser = useCallback(async () => {
     const result = await householdsApi.searchUserForInvite({
       identifier: inviteIdentifier
     });
     setSearchResult(result);
   }, [inviteIdentifier]);

   // UI mejorada
   <View>
     <SegmentedControl
       values={['Email', 'Teléfono']}
       selectedIndex={inviteMethod === 'email' ? 0 : 1}
       onChange={(event) => {
         setInviteMethod(event.nativeEvent.selectedSegmentIndex === 0 ? 'email' : 'phone');
       }}
     />

     <TextField
       placeholder={inviteMethod === 'email'
         ? 'Email (ej: amigo@example.com)'
         : 'Teléfono (ej: +34612345678)'}
       value={inviteIdentifier}
       onChangeText={setInviteIdentifier}
       keyboardType={inviteMethod === 'email' ? 'email-address' : 'phone-pad'}
     />

     <Pressable onPress={onSearchUser}>
       <ThemedText>Buscar usuario</ThemedText>
     </Pressable>

     {searchResult && (
       <View>
         {searchResult.exists ? (
           searchResult.isAlreadyMember ? (
             <ThemedText>⚠️ {searchResult.displayName} ya es miembro</ThemedText>
           ) : (
             <ThemedText>✓ Usuario encontrado: {searchResult.displayName}</ThemedText>
           )
         ) : (
           <ThemedText>Usuario no registrado. Se enviará invitación.</ThemedText>
         )}
       </View>
     )}
   </View>
   ```

2. **Instrucciones dinámicas**
   ```typescript
   const shareMessage = useMemo(() => {
     if (!lastInvite) return '';

     const baseMessage = `Invitación para unirse al hogar y ver listas compartidas (incluye: ${listName}).\n\n`;

     if (lastInvite.method === 'email' && searchResult?.exists) {
       // Usuario existe con email
       return (
         baseMessage +
         `Ya tienes cuenta. Pasos:\n` +
         `1) Inicia sesión con tu email: ${lastInvite.email}\n` +
         `2) Ve a Perfil → Unirme con código\n` +
         `3) Pega este código: ${lastInvite.token}`
       );
     } else if (lastInvite.method === 'phone' && searchResult?.exists) {
       // Usuario existe con phone
       return (
         baseMessage +
         `Ya tienes cuenta. Pasos:\n` +
         `1) Inicia sesión con tu teléfono\n` +
         `2) Ve a Perfil → Unirme con código\n` +
         `3) Pega este código: ${lastInvite.token}`
       );
     } else {
       // Usuario nuevo
       return (
         baseMessage +
         `Pasos:\n` +
         `1) Descarga la app\n` +
         `2) Regístrate con ${lastInvite.method === 'email' ? `este email: ${lastInvite.email}` : `tu teléfono`}\n` +
         `3) La invitación se aceptará automáticamente, o ve a Perfil → Unirme con código si no ocurre\n\n` +
         `Código: ${lastInvite.token}`
       );
     }
   }, [lastInvite, listName, searchResult]);
   ```

---

### Opción B: **Solo Invitación por Token** (Más Simple)

Si se quiere evitar la complejidad de gestionar email vs phone:

1. **Eliminar auto-aceptación por email**
2. **Todas las invitaciones requieren token manual**
3. **Instrucciones simplificadas:**
   ```
   Para unirte al hogar:
   1) Descarga la app
   2) Regístrate con email o teléfono
   3) Ve a Perfil → Unirme con código
   4) Pega este código: [TOKEN]
   ```

**Ventajas:**

- ✅ Más simple de implementar
- ✅ Funciona igual para email y phone
- ✅ No hay riesgo de inconsistencias

**Desventajas:**

- ❌ UX menos fluida (siempre requiere paso manual)
- ❌ Pierde la conveniencia de auto-aceptación

---

### Opción C: **Invitación por Link Profundo** (Más Moderno)

1. **Generar deep link con el token**

   ```typescript
   const inviteLink = `expenseapp://invite/${token}`;
   // O universal link: https://expenseapp.com/invite/${token}
   ```

2. **Al abrir el link:**
   - Si el usuario está logueado → acepta automáticamente
   - Si no está logueado → redirige a registro/login con token en memoria

3. **Instrucciones:**

   ```
   Toca este link para unirte:
   [LINK]

   O copia manualmente el código: [TOKEN]
   ```

**Ventajas:**

- ✅ UX excelente (un solo tap)
- ✅ Funciona para email y phone
- ✅ Compatible con cualquier app de mensajería

**Desventajas:**

- ⚠️ Requiere configurar deep links / universal links
- ⚠️ Más complejo de implementar

---

## Recomendación Final

### Estrategia Híbrida (Mejor balance UX/Complejidad)

1. **Implementar Opción A (Sistema Dual)** para:
   - Permitir invitar por email o phone
   - Buscar usuarios antes de invitar
   - Mostrar instrucciones contextuales

2. **Mejorar mensajes de error:**

   ```typescript
   // Si el usuario intenta invitar a alguien que ya es miembro
   if (searchResult.isAlreadyMember) {
     Alert.alert(
       'Ya es miembro',
       `${searchResult.displayName} ya pertenece a tu hogar.`,
     );
     return;
   }
   ```

3. **Agregar validación en UI:**

   ```typescript
   const validateIdentifier = (value: string, method: 'email' | 'phone') => {
     if (method === 'email') {
       return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
     } else {
       // E.164 format validation
       return /^\+[1-9]\d{1,14}$/.test(value);
     }
   };
   ```

4. **Añadir feedback visual:**
   ```typescript
   {searchResult?.exists && !searchResult.isAlreadyMember && (
     <View style={{ backgroundColor: '#e8f5e9', padding: 12, borderRadius: 8 }}>
       <ThemedText>✓ Usuario encontrado</ThemedText>
       <ThemedText style={{ fontSize: 12, opacity: 0.8 }}>
         {searchResult.displayName} recibirá una invitación para unirse
       </ThemedText>
     </View>
   )}
   ```

---

## Plan de Implementación

### Fase 1: Backend (1-2 días)

- [ ] Migración: agregar `phone_lookup_hash` y `invited_identifier` a invitations
- [ ] Endpoint `searchUserForInvite`
- [ ] Modificar `invite()` para soportar phone
- [ ] Implementar `acceptInvitationForUserByPhone`
- [ ] Actualizar auto-aceptación en `register()`

### Fase 2: Frontend (1-2 días)

- [ ] Componente selector email/phone
- [ ] Hook `useSearchUserForInvite`
- [ ] Validación de email/phone
- [ ] Instrucciones dinámicas según contexto
- [ ] Feedback visual de estados

### Fase 3: Testing (1 día)

- [ ] Test: invitar usuario existente con email
- [ ] Test: invitar usuario existente con phone
- [ ] Test: invitar usuario nuevo
- [ ] Test: prevenir invitar a miembro existente
- [ ] Test: auto-aceptación en registro (ambos métodos)

### Fase 4: Documentación

- [ ] Actualizar README con nuevos flujos
- [ ] Documentar API endpoints
- [ ] Screenshots de nueva UI

---

## Métricas de Éxito

- ✅ 0% de cuentas duplicadas por invitaciones
- ✅ 100% de invitaciones pueden ser aceptadas independientemente del método de registro
- ✅ Instrucciones claras y contextuales en todos los escenarios
- ✅ Validación preventiva antes de crear invitación

---

## Consideraciones de Seguridad

1. **Rate limiting en búsqueda de usuarios:**

   ```typescript
   @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 búsquedas/minuto
   @Post('search-user')
   ```

2. **No exponer información sensible:**
   - No revelar phone completo (solo confirmar existencia)
   - No revelar email completo si el usuario no existe

3. **Validar permisos:**
   - Solo miembros pueden buscar/invitar
   - Prevenir spam de invitaciones

---

## Alternativas Descartadas

### ❌ Permitir agregar email a cuenta con phone

- **Por qué no:** Complejidad de gestión de múltiples identificadores
- **Por qué no:** Riesgo de colisiones si el email ya está registrado

### ❌ Hacer phone público/no encriptado

- **Por qué no:** Requisito de privacidad/seguridad
- **Por qué no:** GDPR/LOPD compliance

### ❌ Migración automática de invitaciones pendientes

- **Por qué no:** Riesgo de vincular invitaciones incorrectamente
- **Mejor:** Dejar que expiren naturalmente

---

## Anexo: Diagrama de Flujo Propuesto

```
Usuario quiere invitar
    ↓
Selecciona método (email/phone)
    ↓
Ingresa identificador
    ↓
Sistema busca usuario
    ↓
┌─────────────────┬──────────────────┬─────────────────┐
│ No existe       │ Existe, no       │ Existe, ya      │
│                 │ miembro          │ miembro         │
├─────────────────┼──────────────────┼─────────────────┤
│ Crear           │ Crear            │ Mostrar error   │
│ invitación      │ invitación       │ "Ya es miembro" │
│ nueva           │ dirigida         │                 │
│                 │                  │                 │
│ Instrucciones:  │ Instrucciones:   │ No continúa     │
│ "Regístrate"    │ "Inicia sesión   │                 │
│                 │ y usa el código" │                 │
└─────────────────┴──────────────────┴─────────────────┘
```

---

_Documento generado: 2026-01-04_
_Autor: AI Development Assistant_
_Estado: Propuesta para revisión_
