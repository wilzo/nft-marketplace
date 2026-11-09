import type { OAuthAccount, OAuthProvider } from '@/api/contracts'

/**
 * Provedores de login social SIMULADOS. Nenhuma chamada sai para o Google ou o Facebook:
 * estas são as contas fictícias que o "provedor" oferece na tela de consentimento.
 * Cada provedor tem uma conta nova (cria conta na Kurio) e uma cujo e-mail já tem conta com senha (conflito).
 */
export const OAUTH_PROVIDER_NAMES: Record<OAuthProvider, string> = { google: 'Google', facebook: 'Facebook' }

export const OAUTH_SCOPES = ['Nome', 'Endereço de e-mail']

export const OAUTH_ACCOUNTS: Record<OAuthProvider, OAuthAccount[]> = {
  google: [
    { subject: 'google-1001', name: 'Carla Nunes', email: 'carla.nunes@gmail.example' },
    { subject: 'google-1002', name: 'Ana Colecionadora', email: 'ana@kurio.dev' },
  ],
  facebook: [
    { subject: 'facebook-2001', name: 'Diego Rocha', email: 'diego.rocha@facebook.example' },
    { subject: 'facebook-2002', name: 'Bruno Mendes', email: 'bruno@kurio.dev' },
  ],
}
