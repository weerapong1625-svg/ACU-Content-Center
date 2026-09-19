export interface UserLoginState {
  email: string;
  rememberMe: boolean;
  isSubmitting: boolean;
  isSuccess: boolean;
  errorMessage: string | null;
}

export interface SchoolInfo {
  nameEn: string;
  nameTh: string;
  systemName: string;
  logoUrl: string;
}
