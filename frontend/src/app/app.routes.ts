import { Routes } from '@angular/router';

import { adminGuard } from './auth/admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('@app/pages/gate/gate.component').then((m) => m.GatePageComponent),
  },
  {
    path: 'boutique',
    loadComponent: () =>
      import('@app/pages/landing/landing.component').then(
        (m) => m.LandingPageComponent,
      ),
  },
  {
    path: 'mes-achats',
    loadComponent: () =>
      import('@app/pages/order-history/order-history-page.component').then(
        (m) => m.OrderHistoryPageComponent,
      ),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('@app/pages/admin-dashboard/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent,
      ),
  },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];
