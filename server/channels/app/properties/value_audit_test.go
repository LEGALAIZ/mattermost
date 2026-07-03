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
	event ValueAuditEvent
}

type recordingSink struct {
	calls []auditCall
}

func (r *recordingSink) sink() ValueAuditSink {
	return func(_ request.CTX, e ValueAuditEvent) {
		r.calls = append(r.calls, auditCall{event: e})
	}
}

var errDenied = errors.New("denied")

func newRegisteredAuditHook(groupID string, sink ValueAuditSink) *PropertyValueAuditHook {
	h := NewPropertyValueAuditHook()
	h.RegisterGroup(groupID, sink)
	return h
}

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

func TestPropertyValueAuditHook_PostCreate(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)

	newValue := func() *model.PropertyValue {
		return &model.PropertyValue{GroupID: managed, TargetType: "user", TargetID: "u1", FieldID: "f1", Value: []byte(`"v"`)}
	}

	t.Run("audits a successful create unconditionally", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		v := newValue()
		require.NoError(t, hook.PostCreatePropertyValue(th.Context, v, nil))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, ValueAuditActionCreate, rec.calls[0].event.Action)
		assert.True(t, rec.calls[0].event.Success())
		assert.Nil(t, rec.calls[0].event.Prev)
		assert.Equal(t, v, rec.calls[0].event.Current)
	})

	t.Run("audits a failed create", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		require.NoError(t, hook.PostCreatePropertyValue(th.Context, newValue(), errDenied))
		require.Len(t, rec.calls, 1)
		assert.False(t, rec.calls[0].event.Success())
		assert.Equal(t, errDenied, rec.calls[0].event.Err)
	})

	t.Run("audits each value in a batch and ignores unregistered groups", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		other := newValue()
		other.GroupID = "other"
		require.NoError(t, hook.PostCreatePropertyValues(th.Context, []*model.PropertyValue{newValue(), other, newValue()}, nil))
		require.Len(t, rec.calls, 2)
	})
}

func TestPropertyValueAuditHook_PostUpdate(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)

	newValue := func() *model.PropertyValue {
		return &model.PropertyValue{GroupID: managed, TargetType: "user", TargetID: "u1", FieldID: "f1", Value: []byte(`"v"`)}
	}

	t.Run("audits a changed value", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		prev := newValue()
		next := newValue()
		next.Value = []byte(`"changed"`)
		require.NoError(t, hook.PostUpdatePropertyValue(th.Context, prev, next, nil))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, ValueAuditActionUpdate, rec.calls[0].event.Action)
	})

	t.Run("skips a no-op", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		require.NoError(t, hook.PostUpdatePropertyValue(th.Context, newValue(), newValue(), nil))
		assert.Empty(t, rec.calls)
	})

	t.Run("audits a failed update that intended a change", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		prev := newValue()
		next := newValue()
		next.Value = []byte(`"changed"`)
		require.NoError(t, hook.PostUpdatePropertyValue(th.Context, prev, next, errDenied))
		require.Len(t, rec.calls, 1)
		assert.False(t, rec.calls[0].event.Success())
	})

	t.Run("aligns prev to values in a batch", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		changed := newValue()
		changed.Value = []byte(`"changed"`)
		prev := []*model.PropertyValue{newValue(), newValue()}
		values := []*model.PropertyValue{newValue(), changed}
		require.NoError(t, hook.PostUpdatePropertyValues(th.Context, prev, values, nil))
		require.Len(t, rec.calls, 1, "only the changed value should audit")
		assert.Equal(t, ValueAuditActionUpdate, rec.calls[0].event.Action)
	})
}

func TestPropertyValueAuditHook_PostUpsert(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)

	newValue := func() *model.PropertyValue {
		return &model.PropertyValue{GroupID: managed, TargetType: "user", TargetID: "u1", FieldID: "f1", Value: []byte(`"v"`)}
	}

	t.Run("audits a new value (no prior)", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, nil, newValue(), nil))
		require.Len(t, rec.calls, 1)
		assert.Equal(t, ValueAuditActionUpsert, rec.calls[0].event.Action)
		assert.Equal(t, "f1", rec.calls[0].event.FieldID)
		assert.True(t, rec.calls[0].event.Success())
	})

	t.Run("skips a no-op (unchanged bytes)", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		prev := newValue()
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, prev, newValue(), nil))
		assert.Empty(t, rec.calls)
	})

	t.Run("audits a changed value", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		prev := newValue()
		next := newValue()
		next.Value = []byte(`"changed"`)
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, prev, next, nil))
		require.Len(t, rec.calls, 1)
	})

	t.Run("audits when the prior value was soft-deleted", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		prev := newValue()
		prev.DeleteAt = 123
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, prev, newValue(), nil))
		require.Len(t, rec.calls, 1)
	})

	t.Run("ignores values in an unregistered group", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		v := newValue()
		v.GroupID = "other"
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, nil, v, nil))
		assert.Empty(t, rec.calls)
	})

	t.Run("audits a failed write that intended a real change", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		prev := newValue()
		next := newValue()
		next.Value = []byte(`"changed"`)
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, prev, next, errDenied))
		require.Len(t, rec.calls, 1)
		assert.False(t, rec.calls[0].event.Success())
		assert.Equal(t, prev, rec.calls[0].event.Prev)
		assert.Equal(t, next, rec.calls[0].event.Current)
		assert.Equal(t, errDenied, rec.calls[0].event.Err)
	})

	t.Run("skips a failed write that was a no-op", func(t *testing.T) {
		rec := &recordingSink{}
		hook := newRegisteredAuditHook(managed, rec.sink())
		prev := newValue()
		require.NoError(t, hook.PostUpsertPropertyValue(th.Context, prev, newValue(), errDenied))
		assert.Empty(t, rec.calls)
	})
}

func TestPropertyValueAuditHook_PostDelete(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)
	rec := &recordingSink{}
	hook := newRegisteredAuditHook(managed, rec.sink())

	require.NoError(t, hook.PostDeletePropertyValue(th.Context, &model.PropertyValue{GroupID: managed, TargetType: "user", TargetID: "u1", FieldID: "f1"}, nil))
	require.NoError(t, hook.PostDeletePropertyValuesForTarget(th.Context, managed, "user", "u1", nil))
	require.NoError(t, hook.PostDeletePropertyValuesForField(th.Context, managed, "f1", nil))

	// A failed delete of an existing value is a legitimate failure → audited.
	require.NoError(t, hook.PostDeletePropertyValue(th.Context, &model.PropertyValue{GroupID: managed, TargetType: "user", TargetID: "u2", FieldID: "f1"}, errDenied))

	// A nil snapshot (value did not exist) is a no-op → not audited.
	require.NoError(t, hook.PostDeletePropertyValue(th.Context, nil, nil))

	// Unregistered group is ignored on every delete variant.
	require.NoError(t, hook.PostDeletePropertyValue(th.Context, &model.PropertyValue{GroupID: "other"}, nil))
	require.NoError(t, hook.PostDeletePropertyValuesForTarget(th.Context, "other", "user", "u1", nil))
	require.NoError(t, hook.PostDeletePropertyValuesForField(th.Context, "other", "f1", nil))

	require.Len(t, rec.calls, 4)
	assert.Equal(t, ValueAuditActionDelete, rec.calls[0].event.Action)
	assert.True(t, rec.calls[0].event.Success())
	assert.Equal(t, ValueAuditActionDeleteForTarget, rec.calls[1].event.Action)
	assert.Equal(t, ValueAuditActionDeleteForField, rec.calls[2].event.Action)
	assert.Equal(t, ValueAuditActionDelete, rec.calls[3].event.Action)
	assert.False(t, rec.calls[3].event.Success())
}

// TestPropertyValueAuditHook_ServiceUpsert exercises the full service path:
// prev capture in the service and no-op detection in the post-hook.
func TestPropertyValueAuditHook_ServiceUpsert(t *testing.T) {
	th := Setup(t)
	managed := registerCPAGroup(t, th)
	rec := &recordingSink{}
	valueAuditHook := NewPropertyValueAuditHook()
	valueAuditHook.RegisterGroup(managed, rec.sink())
	th.service.AddHook(valueAuditHook)

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

	_, err := th.service.UpsertPropertyValue(rctx, value)
	require.NoError(t, err)
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
