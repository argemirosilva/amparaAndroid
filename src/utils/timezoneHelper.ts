/**
 * Timezone Helper
 * 
 * Captura timezone e offset do dispositivo do usuário
 * para envio ao backend.
 */

export interface TimezoneInfo {
  timezone: string;
  timezone_offset_minutes: number;
}

/**
 * Captura informações de timezone do dispositivo
 * 
 * @returns {TimezoneInfo} Timezone IANA e offset em minutos
 */
export function getTimezoneInfo(): TimezoneInfo {
  try {
    // Capturar timezone IANA (ex: "America/Porto_Velho")
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Capturar offset em minutos
    // getTimezoneOffset() retorna minutos para SOMAR ao local e virar UTC
    // Queremos o inverso: UTC + offset = local
    // Exemplo: Porto Velho = UTC-4 = -240 minutos
    const timezone_offset_minutes = -new Date().getTimezoneOffset();
    
    console.log(`[TZ] Timezone captured: ${timezone}, offset: ${timezone_offset_minutes} minutes`);
    
    return {
      timezone,
      timezone_offset_minutes
    };
  } catch (error) {
    console.error('[TZ] Error capturing timezone:', error);
    
    // Fallback: retornar UTC se falhar
    return {
      timezone: 'UTC',
      timezone_offset_minutes: 0
    };
  }
}

/**
 * Salva timezone no storage local
 * 
 * @param {TimezoneInfo} timezoneInfo - Informações de timezone
 */
export function saveTimezoneToStorage(timezoneInfo: TimezoneInfo): void {
  try {
    localStorage.setItem('device_timezone', timezoneInfo.timezone);
    localStorage.setItem('device_timezone_offset_minutes', timezoneInfo.timezone_offset_minutes.toString());
    console.log('[TZ] Timezone saved to storage');
  } catch (error) {
    console.error('[TZ] Error saving timezone to storage:', error);
  }
}

/**
 * Carrega timezone do storage local
 * 
 * @returns {TimezoneInfo | null} Timezone salvo ou null se não existir
 */
export function loadTimezoneFromStorage(): TimezoneInfo | null {
  try {
    const timezone = localStorage.getItem('device_timezone');
    const offset = localStorage.getItem('device_timezone_offset_minutes');
    
    if (timezone && offset) {
      return {
        timezone,
        timezone_offset_minutes: parseInt(offset, 10)
      };
    }
    
    return null;
  } catch (error) {
    console.error('[TZ] Error loading timezone from storage:', error);
    return null;
  }
}

/**
 * Verifica se timezone mudou
 * 
 * @returns {boolean} True se timezone mudou desde última verificação
 */
export function hasTimezoneChanged(): boolean {
  try {
    const current = getTimezoneInfo();
    const saved = loadTimezoneFromStorage();
    
    if (!saved) {
      return true; // Primeira vez, considerar como mudança
    }
    
    const changed = current.timezone !== saved.timezone || 
                    current.timezone_offset_minutes !== saved.timezone_offset_minutes;
    
    if (changed) {
      console.log(`[TZ] Timezone changed: old=${saved.timezone} (${saved.timezone_offset_minutes}), new=${current.timezone} (${current.timezone_offset_minutes})`);
    }
    
    return changed;
  } catch (error) {
    console.error('[TZ] Error checking timezone change:', error);
    return false;
  }
}

/**
 * Atualiza timezone se mudou
 * 
 * @returns {TimezoneInfo} Timezone atual (atualizado se necessário)
 */
export function updateTimezoneIfChanged(): TimezoneInfo {
  const current = getTimezoneInfo();
  
  if (hasTimezoneChanged()) {
    saveTimezoneToStorage(current);
  }
  
  return current;
}
