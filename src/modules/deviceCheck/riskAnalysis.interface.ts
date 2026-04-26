export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type TriState = 'ON' | 'OFF' | 'UNKNOWN';
export type BlacklistState = 'BLACKLISTED' | 'CLEAN' | 'UNKNOWN';
export type SimLockState = 'LOCKED' | 'UNLOCKED' | 'UNKNOWN';
export type CarrierState = 'UNLOCKED' | 'RESTRICTED' | 'BLOCKED' | 'UNKNOWN';
export type ActivationState = 'ISSUE' | 'OK' | 'UNKNOWN';

export type RiskSignals = {
      blacklist: BlacklistState;
      icloud: TriState;
      mdm: TriState;
      simLock: SimLockState;
      carrier: CarrierState;
      fmi: TriState;
      knoxMiLock: TriState;
      activation: ActivationState;
      brand: string;
};

export type ServiceCallResult = {
      payload: unknown;
      errorMessage?: string;
};

export type RawServiceResults = Record<string, ServiceCallResult>;

export type RiskResult = {
      score: number;
      level: RiskLevel;
      issues: string[];
};

export type DeviceChecksResponse = {
      signals: RiskSignals;
      raw: RawServiceResults;
};
