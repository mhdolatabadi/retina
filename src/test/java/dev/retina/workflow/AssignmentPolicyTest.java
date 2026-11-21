package dev.retina.workflow;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class AssignmentPolicyTest {

    @Test
    void allowsAssignmentWhenNoIssueIsDoingOrInReview() {
        assertTrue(AssignmentPolicy.canAssignNewIssue(List.of(
                IssueStatus.ASSIGNED,
                IssueStatus.NEEDS_CLARIFICATION,
                IssueStatus.BLOCKED)));
    }

    @Test
    void rejectsAssignmentWhileAnyIssueIsDoing() {
        assertFalse(AssignmentPolicy.canAssignNewIssue(List.of(
                IssueStatus.ASSIGNED, IssueStatus.DOING)));
    }

    @Test
    void rejectsAssignmentWhileAnyIssueIsInReview() {
        assertFalse(AssignmentPolicy.canAssignNewIssue(List.of(
                IssueStatus.ASSIGNED, IssueStatus.IN_REVIEW)));
    }

    @Test
    void preventsSecondConcurrentDoingIssue() {
        assertFalse(AssignmentPolicy.canStartDoing(List.of(IssueStatus.DOING)));
        assertTrue(AssignmentPolicy.canStartDoing(List.of(IssueStatus.IN_REVIEW)));
    }
}
