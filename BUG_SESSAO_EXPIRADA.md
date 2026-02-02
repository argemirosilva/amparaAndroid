# 🐛 Bug: Sessão Expira e Não Renova Automaticamente

## **Sintoma:**
- App funcionou bem das 21:39 até 22:38 (118 pings bem-sucedidos)
- Às 22:38:55 sessão expirou (401)
- Native enviou notificação para JS renovar token
- **JS NÃO respondeu** (sem logs de `[App] Attempting to refresh token...`)
- Pings continuaram falhando com 401 até a manhã seguinte
- Usuário teve que fazer login novamente

## **Evidências do Log:**

### ✅ Pings funcionando (21:39 - 22:38):
```
02-01 21:39:49.854 D KeepAliveService: Native ping response code: 200
02-01 21:40:19.925 D KeepAliveService: Native ping response code: 200
...
02-01 22:38:23.154 D KeepAliveService: Native ping response code: 200  ← ÚLTIMO SUCESSO
```

### ❌ Sessão expirou (22:38:55):
```
02-01 22:38:55.073 D KeepAliveService: Native ping response code: 401
02-01 22:38:55.074 E KeepAliveService: Session expired (401): {"success":false,"error":"Sessão expirada ou inválida"...}
02-01 22:38:55.075 E KeepAliveService: Session expired confirmed! Notifying JavaScript to refresh token...
02-01 22:38:55.076 D KeepAliveService: Session expired notification sent directly to MainActivity
```

### ⚠️ JS não respondeu:
- **Nenhum log** de `[App] Session expired event from Native:`
- **Nenhum log** de `[App] Attempting to refresh token...`
- **Nenhum log** de `[TokenRefresh] Starting token refresh...`

### 🔁 Native continuou notificando (sem resposta):
```
02-01 22:39:21.616 E KeepAliveService: Session expired confirmed! Notifying JavaScript to refresh token...
02-01 22:39:52.175 E KeepAliveService: Session expired confirmed! Notifying JavaScript to refresh token...
02-01 22:40:21.963 E KeepAliveService: Session expired confirmed! Notifying JavaScript to refresh token...
... (continuou até a manhã)
```

---

## **Hipótese Principal:**

**O JavaScript estava em background/suspenso e não recebeu o evento `sessionExpired` do Native.**

### Por quê?
1. **Tela bloqueada** → WebView pode estar pausada/suspensa
2. **Doze Mode** → Sistema pode ter congelado a WebView
3. **Listener não funciona com app em background** → Eventos Capacitor não chegam ao JS

---

## **Solução: Renovar Token Direto no Native**

### Lógica atual (FALHA):
```
Native (401) → Notifica JS → JS renova token → JS atualiza Native
```

### Lógica nova (FUNCIONA):
```
Native (401) → Native renova token direto → Continua pingando
```

---

## **Implementação:**

### 1. **KeepAliveService.java** - Adicionar método `refreshToken()`:
```java
private boolean refreshToken() {
    try {
        String refreshToken = getRefreshToken(); // Ler do SharedPreferences
        if (refreshToken == null) return false;

        // Chamar API de refresh
        JSONObject payload = new JSONObject();
        payload.put("action", "refresh_token");
        payload.put("refresh_token", refreshToken);

        HttpURLConnection conn = (HttpURLConnection) new URL(API_URL).openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        
        OutputStream os = conn.getOutputStream();
        os.write(payload.toString().getBytes("UTF-8"));
        os.close();

        int responseCode = conn.getResponseCode();
        if (responseCode == 200) {
            BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) {
                response.append(line);
            }
            br.close();

            JSONObject data = new JSONObject(response.toString());
            if (data.getBoolean("success")) {
                String newAccessToken = data.getString("access_token");
                String newRefreshToken = data.getString("refresh_token");
                
                // Salvar novos tokens
                saveSessionToken(newAccessToken);
                saveRefreshToken(newRefreshToken);
                
                Log.d(TAG, "Token refreshed successfully in native!");
                return true;
            }
        }
        
        return false;
    } catch (Exception e) {
        Log.e(TAG, "Failed to refresh token in native", e);
        return false;
    }
}
```

### 2. **Modificar `executePing()` para tentar refresh em 401**:
```java
if (responseCode == 401) {
    Log.e(TAG, "Session expired (401), attempting native token refresh...");
    
    boolean refreshed = refreshToken();
    
    if (refreshed) {
        Log.d(TAG, "Token refreshed, retrying ping...");
        // Retentar ping com novo token
        return executePing(); // Recursão (1 tentativa)
    } else {
        Log.e(TAG, "Token refresh failed, notifying JS...");
        notifySessionExpired(responseBody);
    }
}
```

---

## **Vantagens:**
✅ Funciona com tela bloqueada  
✅ Funciona em Doze Mode  
✅ Não depende de WebView ativa  
✅ Renovação automática transparente  
✅ Fallback para JS se native falhar  

---

## **Teste:**
1. Fazer login
2. Bloquear tela
3. Aguardar ~1h (token expira)
4. Verificar log: deve ver `Token refreshed successfully in native!`
5. Pings devem continuar com 200 (sem 401)
