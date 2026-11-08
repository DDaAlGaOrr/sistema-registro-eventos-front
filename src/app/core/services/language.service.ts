import { Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

type Lang = 'es' | 'en';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  currentLang = signal<Lang>('es');

  constructor(private translate: TranslateService) {
    let saved: Lang | null = null;
    try { saved = localStorage.getItem('lang') as Lang | null; } catch { /* sin almacenamiento */ }
    this.setLanguage(saved === 'en' ? 'en' : 'es');
  }

  toggleLanguage() {
    this.setLanguage(this.currentLang() === 'es' ? 'en' : 'es');
  }

  /**
   * Cambia el idioma cuando ya cargó su archivo de traducción, para que los
   * textos fijos y los que vienen de la API ({es, en}) cambien al mismo tiempo.
   */
  setLanguage(lang: Lang) {
    this.translate.use(lang).subscribe({
      next: () => this.currentLang.set(lang),
      error: () => this.currentLang.set(lang),
    });
    try { localStorage.setItem('lang', lang); } catch { /* sin almacenamiento */ }
  }
}
