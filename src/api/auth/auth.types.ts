export interface RegisterParams {
  salt: string;
  hashedPassword: string;
  givenName: string;
  familyName: string;
  email: string;
  agreedToTOSandPP: boolean;
  gCaptchaResponse?: string;
}

export interface RegisterResponse {
  message: string;
  userId: string;
}

export interface LoginResponse {
  accessTypes?: 'merchant' | 'visaCard' | 'visaManagement'[];
  twoFactorPending?: boolean;
  emailAuthenticationPending?: boolean;
}

export interface LoginErrorResponse {
  message?: string;
  twoFactorPending?: boolean;
  emailAuthenticationPending?: boolean;
}

export interface GeneratePairingCodeResponse {
  data: {
    /**
     * A BitAuth pairing URL.
     */
    url: `bitpay://bitpay.com?secret=${string}&email=${string}`;
  };
}
