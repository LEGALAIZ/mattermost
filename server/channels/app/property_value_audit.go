// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// auditCPAValueChange emits one audit record for a CPA value change attempt.
// It is the ValueAuditSink wired into the property service: the
// AccessControlValueAuditHook calls it from the value post-hooks, which run on
// both the success and failure paths. success selects the record status.
// Logged at the content audit level (data change).
func (a *App) auditCPAValueChange(rctx request.CTX, action, targetType, targetID, fieldID string, success bool) {
	callerID, _ := CallerIDFromRequestContext(rctx)
	scope, _ := ActingAsScopeFromRequestContext(rctx)

	status := model.AuditStatusFail
	if success {
		status = model.AuditStatusSuccess
	}

	rec := a.MakeAuditRecord(rctx, model.AuditEventCPAValueChange, status)
	rec.AddMeta("caller_id", callerID)
	rec.AddMeta("acting_as_scope", scope)
	rec.AddMeta("group", model.AccessControlPropertyGroupName)
	rec.AddMeta("action", action)
	rec.AddMeta("target_type", targetType)
	rec.AddMeta("target_id", targetID)
	if fieldID != "" {
		rec.AddMeta("field_id", fieldID)
	}
	a.LogAuditRecWithLevel(rctx, rec, LevelContent, nil)
}
