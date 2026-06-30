// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type auditCall struct {
	action     string
	targetType string
	targetID   string
	fieldID    string
	success    bool
}

type recordingSink struct {
	calls []auditCall
}

func (r *recordingSink) sink() ValueAuditSink {
	return func(_ request.CTX, action, targetType, targetID, fieldID string, success bool) {
		r.calls = append(r.calls, auditCall{action, targetType, targetID, fieldID, success})
	}
}

var errDenied = errors.New("denied")

// registerCPAGroup registers the CPA property group without adding the access
// control hook, so these tests exercise the audit hook in isolation.
func registerCPAGroup(tb testing.TB, th *TestHelper) string {
	group, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: model.AccessControlPropertyGroupName, Version: model.PropertyGroupVersionV2})
	require.NoError(tb, err)
	return group.ID
}

func TestValueIdentityKey(t *testing.T) {
	// Distinct components must not collide, even when concatenated naively.
	assert.NotEqual(t,
		valueIdentityKey("user", "ab", "c"),
		valueIdentityKey("user", "a", "bc"),
	)
	assert.Equal(t,
		valueIdentityKey("user", "t1", "f1"),
		valueIdentityKey("user", "t1", "f1"),
	)
}

func TestAccessControlValueAuditHook_Attribute(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)
	hook := NewAccessControlValueAuditHook(th.service, nil, managed)

	rctx := RequestContextWithCallerID(th.Context, "caller-1")

	t.Run("stamps CreatedBy and UpdatedBy for a managed-group value", func(t *testing.T) {
		v := &model.PropertyValue{GroupID: managed}
		_, err := hook.PreUpsertPropertyValues(rctx, []*model.PropertyValue{v})
		require.NoError(t, err)
		assert.Equal(t, "caller-1", v.CreatedBy)
		assert.Equal(t, "caller-1", v.UpdatedBy)
	})

	t.Run("preserves an existing CreatedBy but refreshes UpdatedBy", func(t *testing.T) {
		v := &model.PropertyValue{GroupID: managed, CreatedBy: "original-author"}
		_, err := hook.PreUpsertPropertyValue(rctx, v)
		require.NoError(t, err)
		assert.Equal(t, "original-author", v.CreatedBy)
		assert.Equal(t, "caller-1", v.UpdatedBy)
	})

	t.Run("leaves values in an unmanaged group untouched", func(t *testing.T) {
		v := &model.PropertyValue{GroupID: "some-other-group"}
		_, err := hook.PreUpsertPropertyValue(rctx, v)
		require.NoError(t, err)
		assert.Empty(t, v.CreatedBy)
		assert.Empty(t, v.UpdatedBy)
	})

	t.Run("is a no-op without a caller ID", func(t *testing.T) {
		v := &model.PropertyValue{GroupID: managed}
		_, err := hook.PreUpsertPropertyValue(th.Context, v)
		require.NoError(t, err)
		assert.Empty(t, v.CreatedBy)
		assert.Empty(t, v.UpdatedBy)
	})

	t.Run("stamps on create", func(t *testing.T) {
		v := &model.PropertyValue{GroupID: managed}
		_, err := hook.PreCreatePropertyValue(rctx, v)
		require.NoError(t, err)
		assert.Equal(t, "caller-1", v.CreatedBy)
		assert.Equal(t, "caller-1", v.UpdatedBy)

		vs := &model.PropertyValue{GroupID: managed}
		_, err = hook.PreCreatePropertyValues(rctx, []*model.PropertyValue{vs})
		require.NoError(t, err)
		assert.Equal(t, "caller-1", vs.CreatedBy)
	})

	t.Run("refreshes UpdatedBy on update", func(t *testing.T) {
		v := &model.PropertyValue{GroupID: managed, CreatedBy: "original-author"}
		_, err := hook.PreUpdatePropertyValue(rctx, managed, v)
		require.NoError(t, err)
		assert.Equal(t, "original-author", v.CreatedBy)
		assert.Equal(t, "caller-1", v.UpdatedBy)

		vs := &model.PropertyValue{GroupID: managed, CreatedBy: "original-author"}
		_, err = hook.PreUpdatePropertyValues(rctx, managed, []*model.PropertyValue{vs})
		require.NoError(t, err)
		assert.Equal(t, "caller-1", vs.UpdatedBy)
	})
}

func TestAccessControlValueAuditHook_PostCreate(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)

	newValue := func() *model.PropertyValue {
		return &model.PropertyValue{GroupID: managed, TargetType: "user", TargetID: "u1", FieldID: "f1", Value: []byte(`"v"`)}
	}

	t.Run("audits a successful create unconditionally", func(t *testing.T) {
		rec := &recordingSink{}
		hook := NewAccessControlValueAuditHook(th.service, rec.sink(), managed)
		require.NoError(t, hook.PostCreatePropertyValue(th.Context, newValue(), nil))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, cpaValueActionCreate, rec.calls[0].action)
		assert.True(t, rec.calls[0].success)
	})

	t.Run("audits a failed create", func(t *testing.T) {
		rec := &recordingSink{}
		hook := NewAccessControlValueAuditHook(th.service, rec.sink(), managed)
		require.NoError(t, hook.PostCreatePropertyValue(th.Context, newValue(), errDenied))
		require.Len(t, rec.calls, 1)
		assert.False(t, rec.calls[0].success)
	})

	t.Run("audits each value in a batch and ignores unmanaged", func(t *testing.T) {
		rec := &recordingSink{}
		hook := NewAccessControlValueAuditHook(th.service, rec.sink(), managed)
		other := newValue()
		other.GroupID = "other"
		require.NoError(t, hook.PostCreatePropertyValues(th.Context, []*model.PropertyValue{newValue(), other, newValue()}, nil))
		require.Len(t, rec.calls, 2)
	})
}

func TestAccessControlValueAuditHook_PostUpdate(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)

	newValue := func() *model.PropertyValue {
		return &model.PropertyValue{GroupID: managed, TargetType: "user", TargetID: "u1", FieldID: "f1", Value: []byte(`"v"`)}
	}

	t.Run("audits a changed value", func(t *testing.T) {
		rec := &recordingSink{}
		hook := NewAccessControlValueAuditHook(th.service, rec.sink(), managed)
		prev := newValue()
		next := newValue()
		next.Value = []byte(`"changed"`)
		require.NoError(t, hook.PostUpdatePropertyValue(th.Context, prev, next, nil))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, cpaValueActionUpdate, rec.calls[0].action)
	})

	t.Run("skips a no-op", func(t *testing.T) {
		rec := &recordingSink{}
		hook := NewAccessControlValueAuditHook(th.service, rec.sink(), managed)
		require.NoError(t, hook.PostUpdatePropertyValue(th.Context, newValue(), newValue(), nil))
		assert.Empty(t, rec.calls)
	})

	t.Run("audits a failed update that intended a change", func(t *testing.T) {
		rec := &recordingSink{}
		hook := NewAccessControlValueAuditHook(th.service, rec.sink(), managed)
		prev := newValue()
		next := newValue()
		next.Value = []byte(`"changed"`)
		require.NoError(t, hook.PostUpdatePropertyValue(th.Context, prev, next, errDenied))
		require.Len(t, rec.calls, 1)
		assert.False(t, rec.calls[0].success)
	})

	t.Run("aligns prev to values in a batch", func(t *testing.T) {
		rec := &recordingSink{}
		hook := NewAccessControlValueAuditHook(th.service, rec.sink(), managed)
		changed := newValue()
		changed.Value = []byte(`"changed"`)
		prev := []*model.PropertyValue{newValue(), newValue()}
		values := []*model.PropertyValue{newValue(), changed}
		require.NoError(t, hook.PostUpdatePropertyValues(th.Context, prev, values, nil))
		require.Len(t, rec.calls, 1, "only the changed value should audit")
		assert.Equal(t, cpaValueActionUpdate, rec.calls[0].action)
	})
}

func TestAccessControlValueAuditHook_PostUpsert(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)

	newValue := func() *model.PropertyValue {
		return &model.PropertyValue{GroupID: managed, TargetType: "user", TargetID: "u1", FieldID: "f1", Value: []byte(`"v"`)}
	}

	t.Run("audits a new value (no prior)", func(t *testing.T) {
		rec := &recordingSink{}
		hook := NewAccessControlValueAuditHook(th.service, rec.sink(), managed)
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, nil, newValue(), nil))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, cpaValueActionUpsert, rec.calls[0].action)
		assert.Equal(t, "f1", rec.calls[0].fieldID)
		assert.True(t, rec.calls[0].success)
	})

	t.Run("skips a no-op (unchanged bytes)", func(t *testing.T) {
		rec := &recordingSink{}
		hook := NewAccessControlValueAuditHook(th.service, rec.sink(), managed)
		prev := newValue()
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, prev, newValue(), nil))
		assert.Empty(t, rec.calls)
	})

	t.Run("audits a changed value", func(t *testing.T) {
		rec := &recordingSink{}
		hook := NewAccessControlValueAuditHook(th.service, rec.sink(), managed)
		prev := newValue()
		next := newValue()
		next.Value = []byte(`"changed"`)
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, prev, next, nil))
		require.Len(t, rec.calls, 1)
	})

	t.Run("audits when the prior value was soft-deleted", func(t *testing.T) {
		rec := &recordingSink{}
		hook := NewAccessControlValueAuditHook(th.service, rec.sink(), managed)
		prev := newValue()
		prev.DeleteAt = 123
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, prev, newValue(), nil))
		require.Len(t, rec.calls, 1)
	})

	t.Run("ignores values in an unmanaged group", func(t *testing.T) {
		rec := &recordingSink{}
		hook := NewAccessControlValueAuditHook(th.service, rec.sink(), managed)
		v := newValue()
		v.GroupID = "other"
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, nil, v, nil))
		assert.Empty(t, rec.calls)
	})

	t.Run("audits a failed write that intended a real change", func(t *testing.T) {
		rec := &recordingSink{}
		hook := NewAccessControlValueAuditHook(th.service, rec.sink(), managed)
		prev := newValue()
		next := newValue()
		next.Value = []byte(`"changed"`)
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, prev, next, errDenied))
		require.Len(t, rec.calls, 1)
		assert.False(t, rec.calls[0].success)
	})

	t.Run("skips a failed write that was a no-op", func(t *testing.T) {
		rec := &recordingSink{}
		hook := NewAccessControlValueAuditHook(th.service, rec.sink(), managed)
		prev := newValue()
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, prev, newValue(), errDenied))
		assert.Empty(t, rec.calls)
	})
}

func TestAccessControlValueAuditHook_PostDelete(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)
	rec := &recordingSink{}
	hook := NewAccessControlValueAuditHook(th.service, rec.sink(), managed)

	require.NoError(t, hook.PostDeletePropertyValue(th.Context, &model.PropertyValue{GroupID: managed, TargetType: "user", TargetID: "u1", FieldID: "f1"}, nil))
	require.NoError(t, hook.PostDeletePropertyValuesForTarget(th.Context, managed, "user", "u1", nil))
	require.NoError(t, hook.PostDeletePropertyValuesForField(th.Context, managed, "f1", nil))

	// A failed delete of an existing value is a legitimate failure → audited.
	require.NoError(t, hook.PostDeletePropertyValue(th.Context, &model.PropertyValue{GroupID: managed, TargetType: "user", TargetID: "u2", FieldID: "f1"}, errDenied))

	// A nil snapshot (value did not exist) is a no-op → not audited.
	require.NoError(t, hook.PostDeletePropertyValue(th.Context, nil, nil))

	// Unmanaged group is ignored on every delete variant.
	require.NoError(t, hook.PostDeletePropertyValue(th.Context, &model.PropertyValue{GroupID: "other"}, nil))
	require.NoError(t, hook.PostDeletePropertyValuesForTarget(th.Context, "other", "user", "u1", nil))
	require.NoError(t, hook.PostDeletePropertyValuesForField(th.Context, "other", "f1", nil))

	require.Len(t, rec.calls, 4)
	assert.Equal(t, cpaValueActionDelete, rec.calls[0].action)
	assert.True(t, rec.calls[0].success)
	assert.Equal(t, cpaValueActionDeleteForTarget, rec.calls[1].action)
	assert.Equal(t, cpaValueActionDeleteForField, rec.calls[2].action)
	assert.Equal(t, cpaValueActionDelete, rec.calls[3].action)
	assert.False(t, rec.calls[3].success)
}

// TestAccessControlValueAuditHook_ServiceUpsert exercises the full service
// path: attribution in the pre-hook, prev capture in the service, and no-op
// detection in the post-hook.
func TestAccessControlValueAuditHook_ServiceUpsert(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)
	rec := &recordingSink{}
	th.service.AddHook(NewAccessControlValueAuditHook(th.service, rec.sink(), managed))

	field := th.CreatePropertyFieldDirect(t, &model.PropertyField{
		GroupID:    managed,
		Name:       "attr_" + model.NewId()[:8],
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	})

	rctx := RequestContextWithCallerID(th.Context, model.CallerIDLDAPSync)
	value := &model.PropertyValue{
		GroupID:    managed,
		FieldID:    field.ID,
		TargetType: model.PropertyFieldObjectTypeUser,
		TargetID:   model.NewId(),
		Value:      []byte(`"synced"`),
	}

	upserted, err := th.service.UpsertPropertyValue(rctx, value)
	require.NoError(t, err)
	assert.Equal(t, model.CallerIDLDAPSync, upserted.CreatedBy)
	assert.Equal(t, model.CallerIDLDAPSync, upserted.UpdatedBy)
	require.Len(t, rec.calls, 1, "first write should audit")

	// Re-upserting the same value is a no-op and must not audit again.
	rec.calls = nil
	same := &model.PropertyValue{
		GroupID:    managed,
		FieldID:    field.ID,
		TargetType: model.PropertyFieldObjectTypeUser,
		TargetID:   value.TargetID,
		Value:      []byte(`"synced"`),
	}
	_, err = th.service.UpsertPropertyValue(rctx, same)
	require.NoError(t, err)
	assert.Empty(t, rec.calls, "no-op re-write should not audit")
}
