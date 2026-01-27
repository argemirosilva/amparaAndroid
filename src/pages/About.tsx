import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, HelpCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Logo } from '@/components/Logo';

export default function AboutPage() {
  const navigate = useNavigate();
  const [helpContent, setHelpContent] = useState<string | null>(null);
  const [isLoadingHelp, setIsLoadingHelp] = useState(false);
  const [helpError, setHelpError] = useState(false);

  // Load help content from online source
  const loadHelpContent = async () => {
    setIsLoadingHelp(true);
    setHelpError(false);
    
    try {
      // TODO: Replace with actual endpoint URL
      const response = await fetch('https://amparamulher.com.br/api/help-content');
      
      if (!response.ok) {
        throw new Error('Failed to load help content');
      }
      
      const data = await response.json();
      setHelpContent(data.content || 'Conteúdo de ajuda não disponível.');
    } catch (error) {
      console.error('[About] Failed to load help content:', error);
      setHelpError(true);
    } finally {
      setIsLoadingHelp(false);
    }
  };

  useEffect(() => {
    loadHelpContent();
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col safe-area-inset-top safe-area-inset-bottom">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <h1 className="text-lg font-semibold">Sobre</h1>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-6">
        <Tabs defaultValue="terms" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="terms" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Termos de Uso
            </TabsTrigger>
            <TabsTrigger value="help" className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Ajuda
            </TabsTrigger>
          </TabsList>

          {/* Terms of Use Tab */}
          <TabsContent value="terms" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-lg p-6 space-y-4"
            >
              <h2 className="text-xl font-semibold text-foreground">Termos de Uso do AMPARA</h2>
              
              <div className="space-y-4 text-sm text-muted-foreground">
                <section>
                  <h3 className="font-semibold text-foreground mb-2">📱 O que é o AMPARA?</h3>
                  <p>
                    O AMPARA é uma ferramenta de segurança pessoal que monitora situações de risco e envia alertas para sua rede de proteção. 
                    <strong className="text-amber-600"> Importante: o AMPARA não substitui serviços de segurança pública como polícia ou emergência médica.</strong> 
                    É uma camada adicional de proteção, mas não garante proteção total em todas as situações.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-foreground mb-2">📍 Por que pedimos Localização?</h3>
                  <p>
                    A permissão de localização permite que o AMPARA:
                  </p>
                  <ul className="list-disc list-inside ml-2 space-y-1 mt-2">
                    <li>Envie sua localização exata para sua rede de proteção em caso de alerta</li>
                    <li>Melhore o contexto dos registros de segurança</li>
                    <li>Funcione corretamente em segundo plano (requisito do Android)</li>
                  </ul>
                  <p className="mt-2 text-xs text-amber-600">
                    Sua localização é usada apenas para sua segurança e não é compartilhada com terceiros sem sua autorização.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-foreground mb-2">🎤 Por que pedimos Microfone?</h3>
                  <p>
                    A permissão de microfone permite que o AMPARA:
                  </p>
                  <ul className="list-disc list-inside ml-2 space-y-1 mt-2">
                    <li>Monitore sons que possam indicar situações de risco (como discussões ou gritos)</li>
                    <li>Grave áudio quando necessário para documentar situações de emergência</li>
                    <li>Identifique automaticamente quando você pode estar em perigo</li>
                  </ul>
                  <p className="mt-2 text-xs text-amber-600">
                    O áudio é processado localmente no seu celular. Gravações são enviadas apenas quando há um alerta ou você aciona manualmente.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-foreground mb-2">🔋 App Online 24 Horas</h3>
                  <p>
                    O AMPARA foi projetado para funcionar continuamente, mesmo com a tela desligada e o celular no bolso. Isso significa que:
                  </p>
                  <ul className="list-disc list-inside ml-2 space-y-1 mt-2">
                    <li>O app usa recursos do celular (bateria, processamento, internet) para manter a proteção ativa</li>
                    <li>Você pode configurar períodos específicos de monitoramento para economizar bateria</li>
                    <li>O app envia "pings" regulares ao servidor para garantir que está funcionando</li>
                  </ul>
                  <p className="mt-2 text-xs">
                    Recomendamos manter o celular carregado ou com bateria suficiente quando o monitoramento estiver ativo.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-foreground mb-2">🤖 Uso de Dados para Melhorar a IA</h3>
                  <p>
                    As informações geradas pelo AMPARA (como padrões de áudio, horários de alerta e contexto de uso) podem ser usadas para:
                  </p>
                  <ul className="list-disc list-inside ml-2 space-y-1 mt-2">
                    <li>Melhorar a precisão da detecção de situações de risco</li>
                    <li>Reduzir falsos alertas</li>
                    <li>Desenvolver novos recursos de segurança</li>
                  </ul>
                  <p className="mt-2 text-xs text-amber-600">
                    <strong>Privacidade:</strong> Seus dados são tratados com confidencialidade. Informações pessoais identificáveis não são compartilhadas publicamente. 
                    No entanto, dados agregados e anonimizados podem ser usados para pesquisa e melhoria do serviço.
                  </p>
                </section>

                <section>
                  <h3 className="font-semibold text-foreground mb-2">📄 Política Completa</h3>
                  <p>
                    Para mais detalhes sobre como tratamos seus dados e seus direitos, acesse nossa política de privacidade completa:
                  </p>
                  <a
                    href="https://amparamulher.com.br/privacidade"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline mt-2"
                  >
                    amparamulher.com.br/privacidade
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </section>

                <section className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Ao usar o AMPARA, você concorda com estes termos. Se tiver dúvidas, entre em contato através do site 
                    <a href="https://amparamulher.com.br" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline mx-1">
                      amparamulher.com.br
                    </a>
                  </p>
                </section>
              </div>
            </motion.div>
          </TabsContent>

          {/* Help Tab */}
          <TabsContent value="help" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-lg p-6"
            >
              <h2 className="text-xl font-semibold text-foreground mb-4">Manual de Uso</h2>

              {isLoadingHelp && (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Carregando ajuda...</p>
                </div>
              )}

              {helpError && !isLoadingHelp && (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <HelpCircle className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center">
                    Ajuda indisponível no momento.
                    <br />
                    Verifique sua conexão e tente novamente.
                  </p>
                  <Button
                    onClick={loadHelpContent}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Tentar novamente
                  </Button>
                </div>
              )}

              {helpContent && !isLoadingHelp && !helpError && (
                <div className="prose prose-sm max-w-none text-muted-foreground">
                  {/* Fallback static help content */}
                  <section className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">1. O que é "período de monitoramento"?</h3>
                      <p>
                        Período de monitoramento é o horário em que o AMPARA está <strong>ativamente</strong> detectando situações de risco. 
                        Por exemplo: se você configurou monitoramento das 18h às 23h, o app só vai analisar sons e enviar alertas nesse horário.
                      </p>
                      <p className="text-xs mt-2 text-amber-600">
                        💡 <strong>Dica:</strong> Fora do período, o app continua funcionando em segundo plano (para manter conexão com o servidor), 
                        mas NÃO está detectando situações de risco.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">2. Como saber se estou "dentro" ou "fora" do período?</h3>
                      <p>
                        Na tela principal, você verá um dos seguintes status:
                      </p>
                      <ul className="list-disc list-inside ml-2 space-y-1 mt-2">
                        <li><strong className="text-emerald-600">Ativo</strong> (verde): Você está dentro do período de monitoramento. O app está protegendo você agora.</li>
                        <li><strong className="text-primary">Próximo</strong> (azul): Você está fora do período, mas há um próximo período ainda hoje. O app mostra quando começa.</li>
                        <li><strong className="text-muted-foreground">Sem monitoramento</strong> (cinza): Não há mais períodos agendados para hoje.</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">3. O que fazer se estiver "sem monitoramentos agendados para hoje"?</h3>
                      <p>
                        Isso significa que você não configurou nenhum período de monitoramento para hoje (ou todos os períodos já passaram). Para configurar:
                      </p>
                      <ol className="list-decimal list-inside ml-2 space-y-1 mt-2">
                        <li>Clique no menu (☰) no canto superior direito</li>
                        <li>Selecione "Agenda de monitoramento"</li>
                        <li>Adicione os horários que deseja ser monitorada</li>
                        <li>Salve as alterações</li>
                      </ol>
                      <p className="text-xs mt-2">
                        Exemplo: Se você quer proteção das 18h às 23h todos os dias, configure esse horário na agenda.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">4. Permissões do Android (microfone e localização)</h3>
                      <p>
                        O AMPARA precisa de duas permissões principais:
                      </p>
                      <ul className="list-disc list-inside ml-2 space-y-2 mt-2">
                        <li>
                          <strong>Microfone:</strong> Para ouvir sons ao redor e detectar situações de risco (como discussões ou gritos).
                          <br />
                          <span className="text-xs">Como permitir: Configurações do Android → Apps → AMPARA → Permissões → Microfone → Permitir</span>
                        </li>
                        <li>
                          <strong>Localização:</strong> Para enviar sua localização exata em caso de alerta.
                          <br />
                          <span className="text-xs">Como permitir: Configurações do Android → Apps → AMPARA → Permissões → Localização → Permitir o tempo todo</span>
                        </li>
                      </ul>
                      <p className="text-xs mt-2 text-amber-600">
                        ⚠️ <strong>Importante:</strong> Sem essas permissões, o AMPARA não consegue proteger você adequadamente.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">5. O que o app faz em segundo plano?</h3>
                      <p>
                        Mesmo quando você não está usando o celular, o AMPARA:
                      </p>
                      <ul className="list-disc list-inside ml-2 space-y-1 mt-2">
                        <li>Mantém conexão com o servidor (envia "pings" regulares)</li>
                        <li>Monitora sons ao redor (apenas dentro do período configurado)</li>
                        <li>Está pronto para enviar alertas se detectar uma situação de risco</li>
                      </ul>
                      <p className="text-xs mt-2">
                        Isso garante que você esteja protegida mesmo com o celular no bolso ou com a tela desligada.
                      </p>
                    </div>

                    <div className="pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        Ainda tem dúvidas? Entre em contato através do site 
                        <a href="https://amparamulher.com.br" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline mx-1">
                          amparamulher.com.br
                        </a>
                      </p>
                    </div>
                  </section>
                </div>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
