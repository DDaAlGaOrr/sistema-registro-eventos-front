import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLinkActive } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../auth/auth/service/auth.service';

interface NavChild {
  label: string;
  route: string;
}

interface NavItem {
  label: string;
  icon: string;
  route?: string;
  children?: NavChild[];
  expanded?: boolean;
}

interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'superadmin' | 'finanzas' | 'staff' | 'vicePresident' | 'admin' | 'developer';
}

@Component({
  standalone: true,
  selector: 'app-sidebar',
  imports: [CommonModule, RouterModule, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  navItems: NavItem[] = []
  private readonly authService = inject(AuthService)
  constructor(private sanitizer: DomSanitizer) {

  }
  ngOnInit(): void {
    this.authUser = this.authService.getUser() as AuthUser;
    const menuMaestro = [
      {
        label: 'Feja 2026 - Union',
        icon: 'soccer',
        route: '/soccer',
        expanded: true,
        children: [
          {
            label: 'Resumen',
            route: 'congreso/overview',
            roles: ['developer', 'superadmin', 'staff', 'finanzas', 'vicePresident', 'admin']
          },
          {
            label: 'Registros',
            route: 'congreso/registered',
            roles: ['developer', 'superadmin', 'finanzas', 'admin', 'vicePresident']
          },
          {
            label: 'Check-in',
            route: 'congreso/checkin',
            roles: ['developer', 'superadmin', 'staff', 'admin', 'vicePresident']
          },
          {
            label: 'Productos',
            route: 'congreso/products',
            roles: ['developer', 'superadmin', 'finanzas', 'staff', 'admin', 'vicePresident']
          },
          {
            label: 'Logs-Admin',
            route: 'congreso/logs',
            roles: ['developer']
          },
        ],
      }
    ];
    const rolUsuario = this.authUser.role;

    this.navItems = menuMaestro.map(item => {
      const itemFiltrado = { ...item };

      if (itemFiltrado.children) {
        itemFiltrado.children = itemFiltrado.children.filter(child => {
          return rolUsuario === 'developer' || (child.roles && child.roles.includes(rolUsuario));
        });
      }

      return itemFiltrado;
    });

  }
  isCollapsed = false;
  authUser: AuthUser = {} as AuthUser
  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  /* ngOnInit(): void {} */

  toggleExpand(item: NavItem): void {
    if (item.children) {
      const isOpen = item.expanded;
      // Cierra todos
      this.navItems.forEach(n => n.expanded = false);
      // Abre solo el seleccionado (toggle)
      item.expanded = !isOpen;
    }
  }

  getSportIcon(icon: string): SafeHtml { // ← cambia el tipo de retorno
    const icons: Record<string, string> = {
      soccer: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none" /><path fill="#4f46e5" fill-rule="evenodd" d="m14.014 17l-.006 2.003c-.001.47-.002.705-.149.851s-.382.146-.854.146h-3.01c-3.78 0-5.67 0-6.845-1.172c-.81-.806-1.061-1.951-1.14-3.817c-.015-.37-.023-.556.046-.679c.07-.123.345-.277.897-.586a1.999 1.999 0 0 0 0-3.492c-.552-.308-.828-.463-.897-.586s-.061-.308-.045-.679c.078-1.866.33-3.01 1.139-3.817C4.324 4 6.214 4 9.995 4h3.51a.5.5 0 0 1 .501.499L14.014 7c0 .552.449 1 1.002 1v2c-.553 0-1.002.448-1.002 1v2c0 .552.449 1 1.002 1v2c-.553 0-1.002.448-1.002 1" clip-rule="evenodd" /><path fill="#4f46e5" d="M15.017 16c.553 0 1.002.448 1.002 1v1.976c0 .482 0 .723.155.87c.154.148.39.138.863.118c1.863-.079 3.007-.331 3.814-1.136c.809-.806 1.06-1.952 1.139-3.818c.015-.37.023-.555-.046-.678c-.069-.124-.345-.278-.897-.586a1.999 1.999 0 0 1 0-3.492c.552-.309.828-.463.897-.586c.07-.124.061-.309.046-.679c-.079-1.866-.33-3.011-1.14-3.818c-.877-.875-2.154-1.096-4.322-1.152a.497.497 0 0 0-.509.497V7c0 .552-.449 1-1.002 1v2a1 1 0 0 1 1.002 1v2c0 .552-.449 1-1.002 1z" opacity=".5" /></svg>`,
    };

    const svg = icons[icon] ?? '';
    return this.sanitizer.bypassSecurityTrustHtml(svg); // ← marca como seguro
  }

}
