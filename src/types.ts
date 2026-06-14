export interface AttendanceRecord {
  id?: string;
  userId: string;
  employeeName: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  clockInPhoto?: string;
  clockOutPhoto?: string;
  status?: 'present' | 'absent' | 'half-day';
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}
