export type IUserRole = 'client' | 'admin';

export interface IRegisterRequest {
  readonly name: string;
  readonly phone: string;
  readonly localization: string;
}

export interface IRegisterResponse {
  readonly id: number;
  readonly name: string;
  readonly phone: string;
  readonly role: IUserRole;
  /** Jeton pour /api/client/* (profil, commandes, panier en base). */
  readonly access_token?: string;
}
