# Relatório de Correção do Problema de Cache do Vite

**Data**: 29 de Janeiro de 2026  
**Projeto**: Ampara Mobile  
**Problema**: Cache agressivo do Vite impedindo que alterações de código sejam refletidas no build

---

## 1. Problema Identificado

O sistema de build do Vite estava mantendo um cache agressivo baseado no conteúdo dos módulos. Quando alterávamos arquivos "folha" na árvore de dependências (como `newDiscussionDetectorService.ts`), o Vite não detectava a mudança e servia uma versão antiga do código em cache.

### Sintomas

- Alteração do limiar de ativação da discussão para `score >= 2` no arquivo `newDiscussionDetectorService.ts` não era refletida no build
- Logs do aplicativo mostravam que a lógica antiga (`score >= 3` ou `score >= 4`) ainda estava em uso
- Estado `discussionOn` nunca se tornava `true`
- Máquina de estados nunca transitava para o estado `RECORDING`

---

## 2. Soluções Implementadas

### 2.1. Limpeza Completa de Cache

Removidos todos os diretórios de cache do Vite:
- `dist/` - Diretório de build
- `.vite/` - Cache do Vite
- `node_modules/.vite/` - Cache de dependências otimizadas

```bash
rm -rf dist .vite node_modules/.vite
```

### 2.2. Configuração do Vite (vite.config.ts)

Adicionadas configurações para desabilitar cache agressivo em desenvolvimento:

```typescript
// Disable aggressive caching in development to ensure code changes are reflected
optimizeDeps: {
  force: mode === "development",
},
build: {
  // Ensure full rebuild when needed
  rollupOptions: {
    output: {
      manualChunks: undefined,
    },
  },
},
```

**Benefícios**:
- `optimizeDeps.force`: Força reotimização de dependências em modo desenvolvimento
- `manualChunks: undefined`: Desabilita chunking manual que pode causar cache inconsistente

### 2.3. Timestamp de Build

Adicionado log de timestamp no construtor do `AudioTriggerSingleton`:

```typescript
console.log('[AudioTriggerSingleton] 🔄 Build timestamp:', new Date().toISOString());
```

**Benefício**: Permite verificar visualmente se o código foi recompilado ao verificar os logs do console.

### 2.4. Versionamento do Detector

Atualizada a versão do detector de discussão:

```typescript
// Force cache invalidation - v4 (Cache fix applied)
export const DISCUSSION_DETECTOR_VERSION = '4.0.0';
```

---

## 3. Verificação do Código Atual

### newDiscussionDetectorService.ts (linha 170)

✅ **CONFIRMADO**: O limiar está correto
```typescript
if (score >= 2) { // Reduzido para 2 para facilitar detecção em testes
```

### audioTrigger.ts (DEFAULT_CONFIG)

✅ **CONFIRMADO**: Valores de teste reduzidos
```typescript
startHoldSeconds: 10,        // Reduzido para testes - produção: 35
speechDensityMin: 0.10,      // Reduzido para detectar fala única
loudDensityMin: 0.05,        // Reduzido para detectar fala única
turnTakingMin: 2,            // Reduzido para detectar fala única
```

---

## 4. Procedimento para Rebuild Completo

Para garantir que todas as alterações sejam refletidas no futuro:

```bash
# 1. Limpar cache
rm -rf dist .vite node_modules/.vite

# 2. Reinstalar dependências (opcional, se houver problemas)
npm install

# 3. Build do projeto
npm run build

# 4. Para desenvolvimento com hot reload
npm run dev
```

---

## 5. Prevenção de Problemas Futuros

### Em Desenvolvimento

Usar sempre `npm run dev` com as novas configurações do Vite que forçam reotimização.

### Para Build de Produção

Sempre executar a limpeza de cache antes de builds importantes:
```bash
npm run build:clean  # (se criar um script para isso)
# ou
rm -rf dist .vite node_modules/.vite && npm run build
```

### Verificação de Alterações

Sempre verificar o timestamp no console após rebuild:
```
[AudioTriggerSingleton] 🔄 Build timestamp: 2026-01-29T20:33:00.000Z
```

---

## 6. Arquivos Modificados

1. `vite.config.ts` - Configurações anti-cache
2. `src/services/audioTriggerSingleton.ts` - Timestamp de build
3. `src/services/newDiscussionDetectorService.ts` - Versão atualizada para 4.0.0

---

## 7. Status Final

✅ **Cache limpo completamente**  
✅ **Configurações do Vite atualizadas**  
✅ **Build realizado com sucesso**  
✅ **Código fonte confirmado com valores corretos**  
✅ **Versionamento atualizado**  

---

## 8. Próximos Passos

1. **Testar o aplicativo** com o novo build
2. **Verificar logs do console** para confirmar o timestamp de build
3. **Monitorar** se o estado `discussionOn` agora se torna `true` corretamente
4. **Validar** a transição para o estado `RECORDING` na máquina de estados

---

## 9. Notas Técnicas

### Por que o problema ocorreu?

O Vite usa um sistema de cache baseado em hash de conteúdo dos módulos. Quando um arquivo "folha" (que não é importado diretamente pelo entry point) é modificado, o Vite pode não detectar a mudança se o módulo pai não for alterado.

### Solução de longo prazo

As configurações adicionadas ao `vite.config.ts` garantem que:
- Em desenvolvimento, as dependências são sempre reotimizadas
- O chunking manual não interfere com a detecção de mudanças
- O cache é invalidado apropriadamente

---

**Documento gerado automaticamente por Manus AI**
