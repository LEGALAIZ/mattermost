// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestUpsertPropertyValue_CPAAttribution verifies that the common app-layer
// write path stamps caller attribution onto CPA values regardless of which
// owner (here, a synthetic caller) performs the write.
func TestUpsertPropertyValue_CPAAttribution(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	rctx := request.TestContext(t)
	cpaGroup, gErr := th.App.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	require.Nil(t, gErr)

	field := &model.PropertyField{
		GroupID:    cpaGroup.ID,
		Name:       "attr_" + model.NewId()[:8],
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
		Attrs:      model.StringInterface{model.PropertyAttrsAccessMode: model.PropertyAccessModePublic},
	}
	createdField, appErr := th.App.CreatePropertyField(rctx, field, false, "")
	require.Nil(t, appErr)

	callerCtx := RequestContextWithCallerID(rctx, model.CallerIDLDAPSync)

	value := &model.PropertyValue{
		GroupID:    cpaGroup.ID,
		FieldID:    createdField.ID,
		TargetType: model.PropertyFieldObjectTypeUser,
		TargetID:   th.BasicUser.Id,
		Value:      []byte(`"synced-value"`),
	}

	upserted, appErr := th.App.UpsertPropertyValue(callerCtx, value)
	require.Nil(t, appErr)
	require.NotNil(t, upserted)

	got, appErr := th.App.GetPropertyValue(rctx, cpaGroup.ID, upserted.ID)
	require.Nil(t, appErr)
	assert.Equal(t, model.CallerIDLDAPSync, got.CreatedBy)
	assert.Equal(t, model.CallerIDLDAPSync, got.UpdatedBy)
}
