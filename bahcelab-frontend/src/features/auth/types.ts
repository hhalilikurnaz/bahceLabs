export interface AuthUser {
  id: string
  name: string
  email: string
}

export interface StoredUser extends AuthUser {
  password: string
}

export interface AuthSession {
  user: AuthUser
  token: string
}
