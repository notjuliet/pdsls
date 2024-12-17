interface DidDoc {
  "@context": string[];
  id: string;
  alsoKnownAs: string[];
  verificationMethod: DidVerificationMethod[];
  service: DidService[];
}

interface DidVerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase: string;
}

interface DidService {
  id: string;
  type: string;
  serviceEndpoint: string;
}

export type { DidDoc };
