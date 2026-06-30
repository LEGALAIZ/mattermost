// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"bytes"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// CPA value-change audit actions, recorded as the "action" meta on the audit
// record emitted by the ValueAuditSink.
const (
	cpaValueActionCreate          = "create"
	cpaValueActionUpdate          = "update"
	cpaValueActionUpsert          = "upsert"
	cpaValueActionDelete          = "delete"
	cpaValueActionDeleteForTarget = "delete_for_target"
	cpaValueActionDeleteForField  = "delete_for_field"
)

// ValueAuditSink emits one audit record for a property value change attempt.
// success is true when the write went through and false when it was rejected
// or errored. It is injected by the app layer so the properties package stays
// independent of the audit subsystem; the sink itself reads caller identity
// and scope from rctx.
type ValueAuditSink func(rctx request.CTX, action, targetType, targetID, fieldID string, success bool)

// AccessControlValueAuditHook attributes and audits value writes for managed
// (CPA) groups. It is the single place every value owner converges — session
// user, local admin, plugin, and LDAP/SAML sync all funnel through the generic
// value write path — so attribution and auditing live here rather than in each
// API handler.
//
// Attribution (CreatedBy/UpdatedBy) is stamped in the pre-upsert hook; auditing
// happens in the value post-hooks, which run only after the store write
// succeeds. Upserts are diffed against their pre-write state so high-frequency
// sync no-ops do not flood the audit log. The hook self-gates to
// managedGroupIDs, so non-CPA groups are never touched.
type AccessControlValueAuditHook struct {
	BasePropertyHook
	propertyService *PropertyService
	auditSink       ValueAuditSink
	managedGroupIDs map[string]struct{}
}

// NewAccessControlValueAuditHook creates a hook that attributes and audits
// value writes for the given managed groups. sink may be nil (attribution
// still runs; auditing is skipped).
func NewAccessControlValueAuditHook(ps *PropertyService, sink ValueAuditSink, managedGroupIDs ...string) *AccessControlValueAuditHook {
	ids := make(map[string]struct{}, len(managedGroupIDs))
	for _, id := range managedGroupIDs {
		ids[id] = struct{}{}
	}
	return &AccessControlValueAuditHook{
		propertyService: ps,
		auditSink:       sink,
		managedGroupIDs: ids,
	}
}

func (h *AccessControlValueAuditHook) isGroupManaged(groupID string) bool {
	_, ok := h.managedGroupIDs[groupID]
	return ok
}

// attribute stamps CreatedBy/UpdatedBy with the caller for values in a managed
// group, giving every owner uniform on-row attribution. An existing CreatedBy
// set by an upstream handler is preserved.
func (h *AccessControlValueAuditHook) attribute(rctx request.CTX, values []*model.PropertyValue) {
	callerID := h.propertyService.extractCallerID(rctx)
	if callerID == "" {
		return
	}
	for _, v := range values {
		if v == nil || !h.isGroupManaged(v.GroupID) {
			continue
		}
		if v.CreatedBy == "" {
			v.CreatedBy = callerID
		}
		v.UpdatedBy = callerID
	}
}

func (h *AccessControlValueAuditHook) PreCreatePropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	h.attribute(rctx, []*model.PropertyValue{value})
	return value, nil
}

func (h *AccessControlValueAuditHook) PreCreatePropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	h.attribute(rctx, values)
	return values, nil
}

func (h *AccessControlValueAuditHook) PreUpdatePropertyValue(rctx request.CTX, _ string, value *model.PropertyValue) (*model.PropertyValue, error) {
	h.attribute(rctx, []*model.PropertyValue{value})
	return value, nil
}

func (h *AccessControlValueAuditHook) PreUpdatePropertyValues(rctx request.CTX, _ string, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	h.attribute(rctx, values)
	return values, nil
}

func (h *AccessControlValueAuditHook) PreUpsertPropertyValue(rctx request.CTX, value *model.PropertyValue) (*model.PropertyValue, error) {
	h.attribute(rctx, []*model.PropertyValue{value})
	return value, nil
}

func (h *AccessControlValueAuditHook) PreUpsertPropertyValues(rctx request.CTX, values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	h.attribute(rctx, values)
	return values, nil
}

// auditWrite emits an audit record for an attempted write under the given
// action, recording success/failure from opErr. It suppresses no-ops — an
// attempted value equal to the already-stored, non-deleted value — on both the
// success and failure paths, so re-writing an unchanged value never audits even
// if it is rejected. Values are sanitized on write, so a byte comparison is a
// sound no-op test.
func (h *AccessControlValueAuditHook) auditWrite(rctx request.CTX, action string, prev, value *model.PropertyValue, opErr error) {
	if value == nil || h.auditSink == nil || !h.isGroupManaged(value.GroupID) {
		return
	}
	if prev != nil && prev.DeleteAt == 0 && bytes.Equal(prev.Value, value.Value) {
		return
	}
	h.auditSink(rctx, action, value.TargetType, value.TargetID, value.FieldID, opErr == nil)
}

// auditCreate emits a create audit record. A create always introduces a new
// value (a conflicting create fails), so there is no no-op to suppress.
func (h *AccessControlValueAuditHook) auditCreate(rctx request.CTX, value *model.PropertyValue, opErr error) {
	if value == nil || h.auditSink == nil || !h.isGroupManaged(value.GroupID) {
		return
	}
	h.auditSink(rctx, cpaValueActionCreate, value.TargetType, value.TargetID, value.FieldID, opErr == nil)
}

func (h *AccessControlValueAuditHook) PostCreatePropertyValue(rctx request.CTX, value *model.PropertyValue, opErr error) error {
	h.auditCreate(rctx, value, opErr)
	return nil
}

func (h *AccessControlValueAuditHook) PostCreatePropertyValues(rctx request.CTX, values []*model.PropertyValue, opErr error) error {
	for _, v := range values {
		h.auditCreate(rctx, v, opErr)
	}
	return nil
}

func (h *AccessControlValueAuditHook) PostUpdatePropertyValue(rctx request.CTX, prev, value *model.PropertyValue, opErr error) error {
	h.auditWrite(rctx, cpaValueActionUpdate, prev, value, opErr)
	return nil
}

func (h *AccessControlValueAuditHook) PostUpdatePropertyValues(rctx request.CTX, prev, values []*model.PropertyValue, opErr error) error {
	for i, v := range values {
		var p *model.PropertyValue
		if i < len(prev) {
			p = prev[i]
		}
		h.auditWrite(rctx, cpaValueActionUpdate, p, v, opErr)
	}
	return nil
}

func (h *AccessControlValueAuditHook) PostUpsertPropertyValue(rctx request.CTX, prev, value *model.PropertyValue, opErr error) error {
	h.auditWrite(rctx, cpaValueActionUpsert, prev, value, opErr)
	return nil
}

func (h *AccessControlValueAuditHook) PostUpsertPropertyValues(rctx request.CTX, prev, values []*model.PropertyValue, opErr error) error {
	for i, v := range values {
		var p *model.PropertyValue
		if i < len(prev) {
			p = prev[i]
		}
		h.auditWrite(rctx, cpaValueActionUpsert, p, v, opErr)
	}
	return nil
}

func (h *AccessControlValueAuditHook) PostDeletePropertyValue(rctx request.CTX, deleted *model.PropertyValue, opErr error) error {
	// A nil snapshot means the value did not exist — nothing was (or would be)
	// removed, so there is no change to audit.
	if deleted == nil || h.auditSink == nil || !h.isGroupManaged(deleted.GroupID) {
		return nil
	}
	h.auditSink(rctx, cpaValueActionDelete, deleted.TargetType, deleted.TargetID, deleted.FieldID, opErr == nil)
	return nil
}

func (h *AccessControlValueAuditHook) PostDeletePropertyValuesForTarget(rctx request.CTX, groupID, targetType, targetID string, opErr error) error {
	if h.auditSink == nil || !h.isGroupManaged(groupID) {
		return nil
	}
	h.auditSink(rctx, cpaValueActionDeleteForTarget, targetType, targetID, "", opErr == nil)
	return nil
}

func (h *AccessControlValueAuditHook) PostDeletePropertyValuesForField(rctx request.CTX, groupID, fieldID string, opErr error) error {
	if h.auditSink == nil || !h.isGroupManaged(groupID) {
		return nil
	}
	h.auditSink(rctx, cpaValueActionDeleteForField, "", "", fieldID, opErr == nil)
	return nil
}
