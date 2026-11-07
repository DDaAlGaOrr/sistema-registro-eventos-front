import { Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  currentLang = signal<'es' | 'en'>('es');

  constructor(private translate: TranslateService) {
    const saved = localStorage.getItem('lang') as 'es' | 'en' | null;
    const lang = saved ?? 'es';
    this.translate.use(lang);
    this.currentLang.set(lang);
  }

  toggleLanguage() {
    const newLang = this.currentLang() === 'es' ? 'en' : 'es';
    this.translate.use(newLang);
    this.currentLang.set(newLang);
    localStorage.setItem('lang', newLang);
  }

}
