import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth/service/auth.service';

interface UserData {
  name: string,
  role: string,
}

@Component({
  standalone: true,
  selector: 'app-topbar',
  imports: [CommonModule, FormsModule],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss']
})
export class TopbarComponent {
  user: UserData = {} as UserData
  constructor(
    private authService: AuthService,
  ) { }

  ngOnInit() {
    const user = this.authService.getUser();
    if (user) {
      this.user.name = user.email
      this.user.role = user.role
    }
  }
  /* @Input() pageTitle = 'Dashboard';
  @Input() pageBreadcrumb = ''; */

  pageTitle = 'Dashboard';
  pageBreadcrumb = '';

  searchQuery = '';
  hasNotifications = true;



  get initials(): string {
    return this.user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

  logout() {
    this.authService.logout()
  }

}
