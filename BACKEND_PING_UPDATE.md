# Atualização do Endpoint pingMobile - Informações do Dispositivo

## 📋 Resumo

O app mobile agora envia informações detalhadas do dispositivo a cada ping. O backend precisa ser atualizado para receber e armazenar esses dados.

---

## 🔧 Alterações Necessárias no Backend

### 1. Atualizar Tabela `dispositivos_usuarios`

Adicionar as seguintes colunas na tabela `dispositivos_usuarios`:

```sql
ALTER TABLE dispositivos_usuarios 
ADD COLUMN device_model TEXT,
ADD COLUMN battery_level INTEGER,
ADD COLUMN is_charging BOOLEAN,
ADD COLUMN android_version TEXT,
ADD COLUMN app_version TEXT,
ADD COLUMN is_ignoring_battery_optimization BOOLEAN,
ADD COLUMN connection_type TEXT,
ADD COLUMN wifi_signal_strength INTEGER,
ADD COLUMN last_device_info_update TIMESTAMP WITH TIME ZONE;
```

---

### 2. Atualizar Edge Function `mobile-api`

Modificar a ação `pingMobile` para aceitar e processar os novos campos:

#### **Payload Recebido:**

```typescript
{
  action: "pingMobile",
  session_token: string,
  device_id: string,
  email_usuario?: string,
  
  // NOVOS CAMPOS:
  device_model?: string,              // Ex: "Samsung Galaxy S21"
  battery_level?: number,             // 0-100
  is_charging?: boolean,              // true/false
  android_version?: string,           // Ex: "13"
  app_version?: string,               // Ex: "1.0.0"
  is_ignoring_battery_optimization?: boolean,  // true/false
  connection_type?: string,           // "wifi" | "cellular" | "none"
  wifi_signal_strength?: number | null  // 0-100 ou null se não for WiFi
}
```

#### **Lógica de Atualização:**

```typescript
// Após validar o session_token e device_id:

const { data: updateResult, error: updateError } = await supabase
  .from('dispositivos_usuarios')
  .update({
    last_ping: new Date().toISOString(),
    
    // Atualizar informações do dispositivo se fornecidas
    ...(device_model && { device_model }),
    ...(typeof battery_level === 'number' && { battery_level }),
    ...(typeof is_charging === 'boolean' && { is_charging }),
    ...(android_version && { android_version }),
    ...(app_version && { app_version }),
    ...(typeof is_ignoring_battery_optimization === 'boolean' && { is_ignoring_battery_optimization }),
    ...(connection_type && { connection_type }),
    ...(wifi_signal_strength !== undefined && { wifi_signal_strength }),
    
    last_device_info_update: new Date().toISOString(),
  })
  .eq('device_id', device_id)
  .eq('email_usuario', email_usuario);
```

---

### 3. Atualizar Dashboard (Opcional)

Exibir as informações do dispositivo no painel de monitoramento:

- **Nome do Dispositivo**: `device_model`
- **Bateria**: `battery_level%` + ícone de carregamento se `is_charging === true`
- **Versão Android**: `android_version`
- **Versão do App**: `app_version`
- **Otimização de Bateria**: Badge verde se `is_ignoring_battery_optimization === true`
- **Conexão**: Ícone WiFi/Celular + força do sinal (`wifi_signal_strength`)

---

## 📊 Exemplo de Dados Recebidos

```json
{
  "action": "pingMobile",
  "session_token": "abc123...",
  "device_id": "uuid-device-123",
  "email_usuario": "user@example.com",
  "device_model": "Xiaomi Redmi Note 11",
  "battery_level": 85,
  "is_charging": false,
  "android_version": "13",
  "app_version": "1.0.0",
  "is_ignoring_battery_optimization": true,
  "connection_type": "wifi",
  "wifi_signal_strength": 78
}
```

---

## ✅ Checklist de Implementação

- [ ] Adicionar colunas na tabela `dispositivos_usuarios`
- [ ] Atualizar edge function `mobile-api` para processar novos campos
- [ ] Testar com dados reais do app mobile
- [ ] (Opcional) Atualizar dashboard para exibir as informações
- [ ] (Opcional) Criar alertas para bateria baixa ou conexão fraca

---

## 🚀 Benefícios

1. **Monitoramento em tempo real** do estado do dispositivo
2. **Diagnóstico de problemas** (bateria baixa, sem otimização, conexão fraca)
3. **Estatísticas** de uso por modelo de dispositivo e versão do Android
4. **Suporte proativo** ao identificar dispositivos com problemas

---

## 📝 Notas

- Todos os campos são **opcionais** para manter compatibilidade com versões antigas do app
- O `last_device_info_update` permite saber quando foi a última vez que as informações foram atualizadas
- O `wifi_signal_strength` é `null` quando não está conectado em WiFi
