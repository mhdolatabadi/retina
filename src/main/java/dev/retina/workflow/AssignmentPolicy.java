package dev.retina.workflow;

import java.util.Collection;
import java.util.Objects;

/** Evaluates local assignment rules; persistent and atomic claims belong to the scheduler. */
public final class AssignmentPolicy {

    private AssignmentPolicy() {
    }

    public static boolean canAssignNewIssue(Collection<IssueStatus> assignedIssueStatuses) {
        Objects.requireNonNull(assignedIssueStatuses);
        return assignedIssueStatuses.stream()
                .noneMatch(status -> status == IssueStatus.DOING
                        || status == IssueStatus.IN_REVIEW);
    }

    public static boolean canStartDoing(Collection<IssueStatus> assignedIssueStatuses) {
        Objects.requireNonNull(assignedIssueStatuses);
        return assignedIssueStatuses.stream()
                .noneMatch(status -> status == IssueStatus.DOING);
    }
}
