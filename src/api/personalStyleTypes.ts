import type { UserStatus } from 'src/ming-ui/functions/quickSelectUser/types';

/** Empty/null IDs are handled by the controller's Boolean failure branches. */
export type PersonalStatusIdentity = {
  [Field in keyof Pick<UserStatus, 'statusId'>]?: UserStatus[Field] | null;
};

/** The request constructor initializes an empty set when the property is absent. */
export interface AccountsPersonalStatusParams {
  accountIds?: readonly string[] | undefined;
}

/**
 * The two 7.5.2 request models use these same six fields. Nullable strings and
 * DateTime? values retain explicit null; duration reuses the generated backend
 * enum instead of inventing another value list. No default or normalization is performed by the SDK facade.
 */
export type PersonalStatusWriteParams = {
  durationOption?: HapApi.MD.BasicService.Duration_Option | undefined;
} & {
  [Field in keyof Omit<UserStatus, 'accountId' | 'durationOption'>]?: UserStatus[Field] | null;
};

/** GetPersonalStatus explicitly returns null when the service has no model. */
export type PersonalStatusResponse = HapApi.MD.Web.Ajax.ResultModel.Personals.PeronsalStatusModel | null | undefined;

/**
 * AddOrUpdateStatus returns { Success = false } for empty icon/remark. StatusId
 * then remains null. Global null/default serialization is configured in an
 * unavailable framework assembly, so both null and omission remain legal here.
 */
export interface AddOrUpdateStatusResponse {
  success?: boolean | undefined;
  statusId?: PersonalStatusIdentity['statusId'];
}
