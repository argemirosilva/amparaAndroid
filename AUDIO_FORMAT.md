# Formato de Áudio do Ampara Mobile

## 📋 Informação Crítica

**IMPORTANTE:** O aplicativo Ampara Mobile grava áudio no formato **OGG/Opus (.ogg)**, **NÃO em WAV**.

---

## 🎵 Especificações do Formato

### **Formato de Gravação:**
- **Codec:** Opus (via MediaCodec)
- **Container:** OGG
- **Extensão:** `.ogg`
- **Bitrate:** Variável (16-32 kbps para voz)
- **Sample Rate:** 16 kHz
- **Canais:** Mono (1 canal)

### **Localização do Código:**
- **Gravador:** `android/app/src/main/java/tech/orizon/ampara/audio/NativeRecorder.java`
- **Linha 87:** `String filename = String.format(Locale.US, "%s_%03d.ogg", sessionId, segmentIndex);`

---

## 🔧 Cálculo de Duração

### **Método Correto:**
Usar `MediaMetadataRetriever` do Android, que suporta múltiplos formatos:

```java
MediaMetadataRetriever retriever = new MediaMetadataRetriever();
retriever.setDataSource(audioFile.getAbsolutePath());
String durationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
long durationMs = Long.parseLong(durationStr);
double durationSeconds = durationMs / 1000.0;
retriever.release();
```

### **❌ Método Incorreto:**
Tentar ler header WAV em arquivo OGG resulta em valores absurdos:
```
rate=318842413, channels=28320, bits=25697  ← INVÁLIDO
```

---

## 📦 Estrutura de Segmentos

### **Nomenclatura:**
```
{sessionId}_{segmentIndex}.ogg
```

**Exemplos:**
- `20260201_161851_000.ogg` (segmento 0)
- `20260201_161851_001.ogg` (segmento 1)
- `20260201_161851_002.ogg` (segmento 2)

### **Duração de Segmentos:**
- **Padrão:** 30 segundos por segmento
- **Definido em:** `NativeRecorder.java` linha 22
  ```java
  private static final int SEGMENT_DURATION_MS = 30000; // 30 seconds
  ```

---

## 🚀 Upload para Backend

### **Campos Enviados:**
```json
{
  "action": "receberAudioMobile",
  "session_id": "20260201_161851",
  "segmento_idx": 0,
  "duracao_segundos": 28,
  "origem_gravacao": "botao_manual",
  "audio": "[arquivo OGG binário]"
}
```

### **Content-Type:**
```
multipart/form-data; boundary=----Boundary...
```

### **Arquivo:**
```
Content-Disposition: form-data; name="audio"; filename="audio.ogg"
Content-Type: audio/ogg
```

---

## ⚠️ Problemas Comuns

### **1. Duração = 0s**
**Causa:** Tentativa de ler header WAV em arquivo OGG  
**Solução:** Usar `MediaMetadataRetriever`

### **2. Valores Absurdos no Header**
**Causa:** Leitura de bytes OGG como se fossem WAV  
**Solução:** Não tentar parsear header manualmente, usar API do Android

### **3. Arquivo Não Finalizado**
**Causa:** Leitura imediata após `stopRecording()`  
**Solução:** Aguardar 200ms antes de calcular duração

---

## 📝 Histórico de Mudanças

### **2026-02-01 - Correção Crítica**
- ❌ **Antes:** Método `calculateWavDuration()` tentava ler header WAV
- ✅ **Depois:** Método `calculateAudioDuration()` usa `MediaMetadataRetriever`
- **Commit:** 037c37e (primeira tentativa com WAV)
- **Commit:** [próximo] (correção definitiva com MediaMetadataRetriever)

---

## 🔗 Referências

- **MediaCodec (Opus):** https://developer.android.com/reference/android/media/MediaCodec
- **MediaMetadataRetriever:** https://developer.android.com/reference/android/media/MediaMetadataRetriever
- **OGG Container:** https://www.xiph.org/ogg/
- **Opus Codec:** https://opus-codec.org/

---

## ✅ Checklist para Desenvolvedores

Ao trabalhar com áudio no Ampara:

- [ ] Lembrar que arquivos são **OGG/Opus**, não WAV
- [ ] Usar `MediaMetadataRetriever` para extrair metadados
- [ ] Aguardar 200ms após finalizar gravação antes de processar
- [ ] Validar duração calculada (deve ser > 0 e < 3600s)
- [ ] Testar com gravações curtas (5-10s) e longas (>1min)
- [ ] Verificar logs: `Audio duration calculated: X.XXs`

---

**Última Atualização:** 2026-02-01  
**Responsável:** Manus AI Assistant
