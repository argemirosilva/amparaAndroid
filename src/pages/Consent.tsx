import React, { useState } from 'react';
import { IonContent, IonPage, IonButton, IonCheckbox, IonText, IonIcon } from '@ionic/react';
import { micOutline, locationOutline, shieldCheckmarkOutline, warningOutline } from 'ionicons/icons';
import { Preferences } from '@capacitor/preferences';
import './Consent.css';

const Consent: React.FC<{ onAccept: () => void }> = ({ onAccept }) => {
  const [agreed, setAgreed] = useState(false);

  const handleAccept = async () => {
    if (!agreed) {
      return;
    }

    // Salvar consentimento
    await Preferences.set({
      key: 'user_consent_given',
      value: 'true'
    });

    await Preferences.set({
      key: 'consent_timestamp',
      value: new Date().toISOString()
    });

    onAccept();
  };

  return (
    <IonPage>
      <IonContent className="consent-content">
        <div className="consent-container">
          {/* Header */}
          <div className="consent-header">
            <IonIcon icon={shieldCheckmarkOutline} className="consent-icon-main" />
            <h1>Bem-vindo ao Ampara</h1>
            <p className="consent-subtitle">Sua segurança é nossa prioridade</p>
          </div>

          {/* Warning Box */}
          <div className="consent-warning-box">
            <IonIcon icon={warningOutline} className="warning-icon" />
            <h2>Atenção Importante</h2>
            <p>
              Este aplicativo foi desenvolvido para sua <strong>segurança pessoal</strong> em situações de risco.
              Antes de continuar, leia atentamente as informações abaixo.
            </p>
          </div>

          {/* Permissions Section */}
          <div className="consent-section">
            <h3>O Que Este App Faz</h3>

            <div className="consent-item">
              <IonIcon icon={micOutline} className="consent-icon" />
              <div className="consent-item-content">
                <h4>Monitoramento de Áudio Contínuo</h4>
                <ul>
                  <li>Analisa áudio ambiente em tempo real</li>
                  <li>Detecta automaticamente situações de risco (brigas, discussões)</li>
                  <li>Grava evidências quando detecta perigo</li>
                  <li>Funciona mesmo com a tela bloqueada</li>
                  <li>Notificação persistente sempre visível</li>
                </ul>
              </div>
            </div>

            <div className="consent-item">
              <IonIcon icon={locationOutline} className="consent-icon" />
              <div className="consent-item-content">
                <h4>Localização em Tempo Real</h4>
                <ul>
                  <li>Envia sua localização GPS continuamente</li>
                  <li>Permite rastreamento em caso de emergência</li>
                  <li>Funciona em segundo plano</li>
                  <li>Essencial para alertas de segurança</li>
                </ul>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="consent-section">
            <h3>Como Funciona</h3>
            <ol className="consent-steps">
              <li>Você <strong>inicia o monitoramento</strong> manualmente no app</li>
              <li>O app <strong>analisa o áudio ambiente</strong> continuamente</li>
              <li>Quando detecta uma briga, <strong>grava automaticamente</strong></li>
              <li>Envia <strong>alertas e sua localização</strong> para contatos de emergência</li>
              <li>Você pode <strong>parar a qualquer momento</strong></li>
            </ol>
          </div>

          {/* Your Rights */}
          <div className="consent-section">
            <h3>Seus Direitos</h3>
            <ul className="consent-rights">
              <li>✓ Controle total sobre início e fim do monitoramento</li>
              <li>✓ Acesso a todas as gravações feitas</li>
              <li>✓ Deletar gravações a qualquer momento</li>
              <li>✓ Revogar consentimento e desinstalar o app</li>
              <li>✓ Solicitar exclusão de todos os seus dados</li>
            </ul>
          </div>

          {/* Privacy Notice */}
          <div className="consent-privacy">
            <p>
              <strong>Privacidade:</strong> Suas gravações são criptografadas e armazenadas com segurança.
              Apenas você e seus contatos de emergência autorizados têm acesso.
              Leia nossa <a href="/privacy-policy" target="_blank">Política de Privacidade</a> completa.
            </p>
          </div>

          {/* Consent Checkbox */}
          <div className="consent-checkbox-container">
            <IonCheckbox
              checked={agreed}
              onIonChange={e => setAgreed(e.detail.checked)}
              className="consent-checkbox"
            />
            <IonText className="consent-checkbox-label">
              <p>
                Li e compreendo que este app irá <strong>monitorar áudio continuamente</strong>,{' '}
                <strong>gravar automaticamente</strong> quando detectar brigas, e{' '}
                <strong>enviar minha localização</strong> em tempo real. Concordo com o uso dessas
                funcionalidades para minha segurança pessoal.
              </p>
            </IonText>
          </div>

          {/* Action Buttons */}
          <div className="consent-actions">
            <IonButton
              expand="block"
              color="primary"
              disabled={!agreed}
              onClick={handleAccept}
              className="consent-button-accept"
            >
              Concordo e Continuar
            </IonButton>
            <IonButton
              expand="block"
              fill="clear"
              color="medium"
              routerLink="/exit"
              className="consent-button-decline"
            >
              Não Concordo - Sair
            </IonButton>
          </div>

          {/* Footer */}
          <div className="consent-footer">
            <p>
              Ao continuar, você concorda com nossos{' '}
              <a href="/terms" target="_blank">Termos de Uso</a> e{' '}
              <a href="/privacy-policy" target="_blank">Política de Privacidade</a>
            </p>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Consent;
