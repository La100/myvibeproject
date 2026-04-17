export type TeamMemberNotificationSettings = {
  taskAssigned: boolean;
  taskUnassigned: boolean;
  taskStatusUpdated: boolean;
  taskDueDateChanged: boolean;
  taskComments: boolean;
};

export const DEFAULT_TEAM_MEMBER_NOTIFICATION_SETTINGS: TeamMemberNotificationSettings =
  {
    taskAssigned: false,
    taskUnassigned: false,
    taskStatusUpdated: false,
    taskDueDateChanged: false,
    taskComments: false,
  };

export const resolveTeamMemberNotificationSettings = (
  settings?: Partial<TeamMemberNotificationSettings> | null,
): TeamMemberNotificationSettings => ({
  ...DEFAULT_TEAM_MEMBER_NOTIFICATION_SETTINGS,
  ...(settings ?? {}),
});
