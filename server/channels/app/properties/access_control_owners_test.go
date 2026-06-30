// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ownerField builds a CPA text field owned by the given plugin id for the given scopes.
func ownerField(groupID, name, pluginID string, scopes []string) *model.PropertyField {
	return &model.PropertyField{
		GroupID:    groupID,
		Name:       name,
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs: model.StringInterface{
			model.PropertyAttrsOwners: []model.PropertyOwner{
				{ID: pluginID, Type: model.PropertyOwnerTypePlugin, Scopes: scopes},
			},
		},
	}
}

func TestOwnerValueWriteAccessControl(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-owner" || pluginID == "plugin-other"
	})

	// The owner plugin assigns ownership on an empty (legacy) field — allowed
	// because the *existing* field has no owners yet.
	rctxOwner := RequestContextWithCallerID(th.Context, "plugin-owner")
	created, err := th.service.CreatePropertyField(rctxOwner, ownerField(th.CPAGroupID, "Owned", "plugin-owner", []string{"entra"}))
	require.NoError(t, err)
	require.True(t, model.HasPropertyFieldOwners(created))

	newValue := func() *model.PropertyValue {
		return &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"v"`),
		}
	}

	t.Run("allows owner plugin writing with a matching scope", func(t *testing.T) {
		rctx := RequestContextWithCallerIDAndScope(th.Context, "plugin-owner", "entra")
		v, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.NoError(t, upErr)
		assert.NotNil(t, v)
	})

	t.Run("denies owner plugin writing with a non-matching scope", func(t *testing.T) {
		rctx := RequestContextWithCallerIDAndScope(th.Context, "plugin-owner", "okta")
		_, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.Error(t, upErr)
	})

	t.Run("denies owner plugin writing with no scope", func(t *testing.T) {
		rctx := RequestContextWithCallerID(th.Context, "plugin-owner")
		_, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.Error(t, upErr)
	})

	t.Run("denies a non-owner plugin even with the right scope", func(t *testing.T) {
		rctx := RequestContextWithCallerIDAndScope(th.Context, "plugin-other", "entra")
		_, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.Error(t, upErr)
	})

	t.Run("allows a human caller through (governed by API permission levels, not owners)", func(t *testing.T) {
		// A session user is not a machine caller, so the owner gate lets it
		// pass; the API layer's pinned permission levels govern humans.
		rctx := RequestContextWithCallerID(th.Context, model.NewId())
		v, upErr := th.service.UpsertPropertyValue(rctx, newValue())
		require.NoError(t, upErr)
		assert.NotNil(t, v)
	})
}

func TestOwnerFieldWriteAccessControl(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-owner" || pluginID == "plugin-other"
	})

	rctxOwner := RequestContextWithCallerID(th.Context, "plugin-owner")
	created, err := th.service.CreatePropertyField(rctxOwner, ownerField(th.CPAGroupID, "OwnedField", "plugin-owner", []string{"entra"}))
	require.NoError(t, err)

	t.Run("owner plugin may edit the field definition (scope not required)", func(t *testing.T) {
		created.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility] = model.PropertyFieldVisibilityAlways
		_, _, upErr := th.service.UpdatePropertyField(rctxOwner, th.CPAGroupID, created)
		require.NoError(t, upErr)
	})

	t.Run("a non-owner plugin may not edit an owner-managed field", func(t *testing.T) {
		rctxOther := RequestContextWithCallerID(th.Context, "plugin-other")
		existing, getErr := th.service.GetPropertyField(rctxOther, th.CPAGroupID, created.ID)
		require.NoError(t, getErr)
		existing.Attrs[model.CustomProfileAttributesPropertyAttrsVisibility] = model.PropertyFieldVisibilityHidden
		_, _, upErr := th.service.UpdatePropertyField(rctxOther, th.CPAGroupID, existing)
		require.Error(t, upErr)
	})
}

func TestOwnerSupersedesLegacyAndSyncLockUnaffected(t *testing.T) {
	th := Setup(t).RegisterCPAPropertyGroup(t)
	th.service.setPluginCheckerForTests(func(pluginID string) bool {
		return pluginID == "plugin-owner"
	})

	t.Run("legacy sync-locked field with no owners is still gated by the sync lock", func(t *testing.T) {
		rctx := RequestContextWithCallerID(th.Context, model.CallerIDLDAPSync)
		field := &model.PropertyField{
			GroupID:    th.CPAGroupID,
			Name:       "LdapSynced",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeUser,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Attrs: model.StringInterface{
				model.CustomProfileAttributesPropertyAttrsLDAP: "employeeID",
			},
		}
		created, err := th.service.CreatePropertyField(rctx, field)
		require.NoError(t, err)
		require.False(t, model.HasPropertyFieldOwners(created))

		value := &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"v"`),
		}

		// LDAP sync caller allowed through the legacy sync-lock path.
		_, upErr := th.service.UpsertPropertyValue(rctx, value)
		require.NoError(t, upErr)

		// A plugin caller is rejected by the sync lock.
		rctxPlugin := RequestContextWithCallerIDAndScope(th.Context, "plugin-owner", "entra")
		_, upErr = th.service.UpsertPropertyValue(rctxPlugin, &model.PropertyValue{
			GroupID:    th.CPAGroupID,
			FieldID:    created.ID,
			TargetType: "user",
			TargetID:   model.NewId(),
			Value:      json.RawMessage(`"v"`),
		})
		require.Error(t, upErr)
	})
}
