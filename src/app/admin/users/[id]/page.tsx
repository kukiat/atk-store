import {
  ArrowLeft,
  Ban,
  RotateCcw,
  ShieldMinus,
  TimerOff,
  Unlock,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ConfirmSubmitButton,
  FormPendingOverlay,
} from "@/app/admin/confirm-submit-button";
import {
  blockUserAction,
  disableUserAction,
  resetFaceEnrollmentAction,
  revokeAdminRoleAction,
  unblockUserAction,
} from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth";
import { getHighestRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { adminUserService } from "@/services/admin-user.service";

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function statusVariant(status: string) {
  if (status === "active") return "secondary" as const;
  if (status === "blocked") return "destructive" as const;
  return "outline" as const;
}

function HiddenUserId({ userId }: { userId: number }) {
  return <input type="hidden" name="userId" value={userId} />;
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) notFound();

  const currentUser = await requireCurrentUser();
  const actor = await adminUserService.getActor(currentUser);
  const detail = await adminUserService.getUserDetail(actor, userId);
  const highestRole = getHighestRole(detail.roleCodes);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/admin/users"
          className={cn(buttonVariants({ variant: "ghost" }))}
        >
          <ArrowLeft className="size-4" />
          Users
        </Link>
        <Badge variant={detail.canManage ? "secondary" : "outline"}>
          {detail.canManage ? "manageable" : "read only"}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{detail.user.name ?? "No name"}</CardTitle>
              <CardDescription>{detail.user.email}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Info label="Role" value={highestRole} />
              <Info label="Account status">
                <Badge variant={statusVariant(detail.user.accountStatus)}>
                  {detail.user.accountStatus}
                </Badge>
              </Info>
              <Info
                label="Face enrollment"
                value={detail.user.faceEnrollmentStatus}
              />
              <Info
                label="Face registered"
                value={formatDate(detail.user.faceRegisteredAt)}
              />
              <Info label="Created" value={formatDate(detail.user.createdAt)} />
              <Info
                label="Last login"
                value={formatDate(detail.user.lastLoginAt)}
              />
              <Info
                label="Disabled until"
                value={formatDate(detail.user.disabledUntil)}
              />
              <Info
                label="Reason"
                value={detail.user.disabledReason ?? "-"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Face profile</CardTitle>
              <CardDescription>
                Metadata only. Rekognition collection stores the face vector.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {detail.faceProfile ? (
                <>
                  <Info
                    label="Collection"
                    value={detail.faceProfile.collectionId}
                    wrap
                  />
                  <Info label="FaceId" value={detail.faceProfile.faceId} wrap />
                  <Info
                    label="ImageId"
                    value={detail.faceProfile.imageId ?? "-"}
                    wrap
                  />
                  <Info
                    label="Reference S3 key"
                    value={detail.faceProfile.referenceS3Key ?? "-"}
                    wrap
                  />
                </>
              ) : (
                <p className="text-muted-foreground">
                  ยังไม่มี face profile สำหรับ user นี้
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent liveness attempts</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.attempts.length > 0 ? (
                <>
                  <div className="grid gap-3 sm:hidden">
                    {detail.attempts.map((attempt) => (
                      <div
                        key={attempt.id}
                        className="border-border grid gap-3 rounded-lg border p-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{attempt.intent}</span>
                          <Badge variant="outline">{attempt.status}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Info
                            label="Created"
                            value={formatDate(attempt.createdAt)}
                          />
                          <Info
                            label="Confidence"
                            value={attempt.confidence?.toFixed(2) ?? "-"}
                          />
                          <Info
                            label="Recognition"
                            value={attempt.recognitionOutcome ?? "-"}
                          />
                          <Info
                            label="Similarity"
                            value={attempt.faceSimilarity?.toFixed(2) ?? "-"}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="text-muted-foreground border-b text-xs">
                        <tr>
                          <th className="py-2 pr-3 font-medium">Created</th>
                          <th className="py-2 pr-3 font-medium">Intent</th>
                          <th className="py-2 pr-3 font-medium">Status</th>
                          <th className="py-2 pr-3 font-medium">Confidence</th>
                          <th className="py-2 pr-3 font-medium">Recognition</th>
                          <th className="py-2 font-medium">Similarity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {detail.attempts.map((attempt) => (
                          <tr key={attempt.id}>
                            <td className="py-2 pr-3 tabular-nums">
                              {formatDate(attempt.createdAt)}
                            </td>
                            <td className="py-2 pr-3">{attempt.intent}</td>
                            <td className="py-2 pr-3">{attempt.status}</td>
                            <td className="py-2 pr-3 tabular-nums">
                              {attempt.confidence?.toFixed(2) ?? "-"}
                            </td>
                            <td className="py-2 pr-3">
                              {attempt.recognitionOutcome ?? "-"}
                            </td>
                            <td className="py-2 tabular-nums">
                              {attempt.faceSimilarity?.toFixed(2) ?? "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">
                  ยังไม่มี liveness attempt
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Admin actions</CardTitle>
              <CardDescription>
                ทุก action จะถูกบันทึกใน audit log
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {detail.canManage ? (
                <>
                  {detail.user.accountStatus === "active" ? (
                    <form
                      action={blockUserAction}
                      className="relative grid gap-2"
                    >
                      <FormPendingOverlay label="Blocking user" />
                      <HiddenUserId userId={detail.user.id} />
                      <label className="grid gap-1 text-sm">
                        <span className="font-medium">Block reason</span>
                        <input
                          name="reason"
                          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
                          placeholder="Policy violation"
                        />
                      </label>
                      <ConfirmSubmitButton
                        title="Block user?"
                        description={`This will block ${detail.user.email} and record the action in the audit log.`}
                        confirmLabel="Block user"
                        variant="destructive"
                        confirmVariant="destructive"
                        className="w-full"
                      >
                        <Ban className="size-4" />
                        Block user
                      </ConfirmSubmitButton>
                    </form>
                  ) : (
                    <form action={unblockUserAction} className="relative">
                      <FormPendingOverlay label="Activating user" />
                      <HiddenUserId userId={detail.user.id} />
                      <ConfirmSubmitButton
                        title="Set user active?"
                        description={`This will reactivate ${detail.user.email}.`}
                        confirmLabel="Set active"
                        className="w-full"
                      >
                        <Unlock className="size-4" />
                        Set active
                      </ConfirmSubmitButton>
                    </form>
                  )}

                  <form
                    action={disableUserAction}
                    className="relative grid gap-2"
                  >
                    <FormPendingOverlay label="Disabling user" />
                    <HiddenUserId userId={detail.user.id} />
                    <label className="grid gap-1 text-sm">
                      <span className="font-medium">Disable until</span>
                      <input
                        name="disabledUntil"
                        type="datetime-local"
                        required
                        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="font-medium">Reason</span>
                      <input
                        name="reason"
                        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-lg border px-3 text-sm outline-none focus-visible:ring-3"
                        placeholder="Temporary restriction"
                      />
                    </label>
                    <ConfirmSubmitButton
                      title="Temporarily disable user?"
                      description={`This will disable ${detail.user.email} until the selected date and time.`}
                      confirmLabel="Disable user"
                      variant="outline"
                      className="w-full"
                    >
                      <TimerOff className="size-4" />
                      Temporarily disable
                    </ConfirmSubmitButton>
                  </form>

                  <form
                    action={resetFaceEnrollmentAction}
                    className="relative"
                  >
                    <FormPendingOverlay label="Resetting face enrollment" />
                    <HiddenUserId userId={detail.user.id} />
                    <ConfirmSubmitButton
                      title="Reset face enrollment?"
                      description={`This will require ${detail.user.email} to register face verification again.`}
                      confirmLabel="Reset face"
                      variant="outline"
                      className="w-full"
                    >
                      <RotateCcw className="size-4" />
                      Reset face enrollment
                    </ConfirmSubmitButton>
                  </form>

                  {actor.permissions.canManageAdmins &&
                  highestRole === "admin" ? (
                    <form action={revokeAdminRoleAction} className="relative">
                      <FormPendingOverlay label="Revoking admin" />
                      <HiddenUserId userId={detail.user.id} />
                      <ConfirmSubmitButton
                        title="Revoke admin role?"
                        description={`This will remove admin permissions from ${detail.user.email}.`}
                        confirmLabel="Revoke admin"
                        variant="destructive"
                        confirmVariant="destructive"
                        className="w-full"
                      >
                        <ShieldMinus className="size-4" />
                        Revoke admin role
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  คุณไม่มีสิทธิ์จัดการ user นี้
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit log</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {detail.auditLogs.length > 0 ? (
                detail.auditLogs.map((log) => (
                  <div key={log.id} className="border-b pb-3 text-sm last:border-0">
                    <p className="font-medium">{log.action}</p>
                    <p className="text-muted-foreground tabular-nums">
                      {formatDate(log.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  ยังไม่มี audit log
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  children,
  wrap = false,
}: {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
  wrap?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div
        className={
          wrap
            ? "break-all text-sm font-medium"
            : "truncate text-sm font-medium"
        }
      >
        {children ?? value}
      </div>
    </div>
  );
}
