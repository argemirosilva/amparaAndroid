import React, { useState, useEffect } from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons, IonBackButton, IonGrid, IonRow, IonCol, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonText, IonIcon, IonSpinner, IonToast } from '@ionic/react';
import { checkmarkCircle } from 'ionicons/icons';
import { useIconChanger, AVAILABLE_ICONS } from '../composables/useIconChanger';
import './IconSelector.css';

// Import das imagens dos ícones
import iconAmpara from '../assets/icon_ampara_original.png';
import iconWorkout from '../assets/icon_fitness_workout.png';
import iconSteps from '../assets/icon_fitness_steps.png';
import iconYoga from '../assets/icon_fitness_yoga.png';
import iconCycle from '../assets/icon_feminine_cycle.png';
import iconBeauty from '../assets/icon_feminine_beauty.png';
import iconFashion from '../assets/icon_feminine_fashion.png';
import iconPuzzle from '../assets/icon_game_puzzle.png';
import iconCards from '../assets/icon_game_cards.png';
import iconCasual from '../assets/icon_game_casual.png';

const IconSelector: React.FC = () => {
  const { changeIcon, getCurrentIcon, isNative } = useIconChanger();
  const [currentIconId, setCurrentIconId] = useState<string>('ampara');
  const [loading, setLoading] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  useEffect(() => {
    loadCurrentIcon();
  }, []);

  const loadCurrentIcon = async () => {
    const iconId = await getCurrentIcon();
    setCurrentIconId(iconId);
  };

  const handleIconSelect = async (iconId: string) => {
    if (!isNative) {
      setToastMessage('Troca de ícone disponível apenas no app Android');
      setShowToast(true);
      return;
    }

    if (iconId === currentIconId) {
      return;
    }

    setLoading(true);

    try {
      const success = await changeIcon(iconId);
      
      if (success) {
        setCurrentIconId(iconId);
        setToastMessage('Ícone alterado com sucesso! O app será reiniciado.');
        setShowToast(true);
        
        // Aguardar um pouco antes de recarregar
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setToastMessage('Erro ao alterar ícone. Tente novamente.');
        setShowToast(true);
      }
    } catch (error) {
      console.error('Error changing icon:', error);
      setToastMessage('Erro ao alterar ícone. Tente novamente.');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const getIconImage = (iconId: string) => {
    // Mapear IDs para as imagens importadas
    const iconMap: Record<string, string> = {
      ampara: iconAmpara,
      workout: iconWorkout,
      steps: iconSteps,
      yoga: iconYoga,
      cycle: iconCycle,
      beauty: iconBeauty,
      fashion: iconFashion,
      puzzle: iconPuzzle,
      cards: iconCards,
      casual: iconCasual,
    };
    return iconMap[iconId] || iconAmpara;
  };

  const getCategoryTitle = (category: string) => {
    const titles: Record<string, string> = {
      original: '🎯 Original',
      fitness: '🏋️ Fitness',
      feminine: '💄 Feminino',
      games: '🎮 Jogos',
    };
    return titles[category] || category;
  };

  // Agrupar ícones por categoria
  const groupedIcons = AVAILABLE_ICONS.reduce((acc, icon) => {
    if (!acc[icon.category]) {
      acc[icon.category] = [];
    }
    acc[icon.category].push(icon);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_ICONS>);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" />
          </IonButtons>
          <IonTitle>Alterar Ícone do App</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div className="icon-selector-container">
          <IonText className="ion-padding">
            <h2>Escolha um ícone</h2>
            <p>Selecione o ícone que aparecerá na tela inicial do seu celular. O app será reiniciado após a mudança.</p>
          </IonText>

          {Object.entries(groupedIcons).map(([category, icons]) => (
            <div key={category} className="category-section">
              <IonText color="primary">
                <h3>{getCategoryTitle(category)}</h3>
              </IonText>

              <IonGrid>
                <IonRow>
                  {icons.map((icon) => (
                    <IonCol size="6" sizeMd="4" sizeLg="3" key={icon.id}>
                      <IonCard
                        button
                        onClick={() => handleIconSelect(icon.id)}
                        className={`icon-card ${currentIconId === icon.id ? 'selected' : ''}`}
                        disabled={loading}
                      >
                        <div className="icon-image-container">
                          <img
                            src={getIconImage(icon.id)}
                            alt={icon.name}
                            className="icon-image"
                          />
                          {currentIconId === icon.id && (
                            <div className="selected-badge">
                              <IonIcon icon={checkmarkCircle} color="success" />
                            </div>
                          )}
                        </div>
                        <IonCardHeader>
                          <IonCardTitle className="icon-title">{icon.name}</IonCardTitle>
                        </IonCardHeader>
                        <IonCardContent>
                          <IonText color="medium">
                            <small>{icon.description}</small>
                          </IonText>
                        </IonCardContent>
                      </IonCard>
                    </IonCol>
                  ))}
                </IonRow>
              </IonGrid>
            </div>
          ))}

          {loading && (
            <div className="loading-overlay">
              <IonSpinner name="crescent" />
              <p>Alterando ícone...</p>
            </div>
          )}
        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2000}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
};

export default IconSelector;
