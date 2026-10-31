import { Routes } from '@angular/router';
import { DocsPage } from './docs';
import { HistoryPage } from './history';
import { IdsPage } from './ids';
import { Quick } from './quick';
import { SettingsPage } from './settings';
import { Shell } from './shell';

export const routes: Routes = [
  { path: 'quick', component: Quick },
  {
    path: '',
    component: Shell,
    children: [
      { path: 'history', component: HistoryPage, title: 'History · Clipvault' },
      { path: 'ids', component: IdsPage, title: 'IDs · Clipvault' },
      { path: 'docs', component: DocsPage, title: 'Documents · Clipvault' },
      { path: 'settings', component: SettingsPage, title: 'Settings · Clipvault' },
      { path: '', pathMatch: 'full', redirectTo: 'history' },
    ],
  },
  { path: '**', redirectTo: '' },
];
