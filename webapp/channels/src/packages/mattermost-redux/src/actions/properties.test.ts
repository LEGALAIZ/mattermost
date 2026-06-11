// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import type {PropertyField} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {patchSessionAttributeField} from 'mattermost-redux/actions/properties';
import {Client4} from 'mattermost-redux/client';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import configureStore from 'packages/mattermost-redux/test/test_store';

const GROUP = 'session_attributes';
const OBJECT_TYPE = 'session';

function makeField(id: string, attrs: Record<string, unknown>): PropertyField {
    return {
        id,
        name: id,
        type: 'text',
        group_id: GROUP,
        create_at: 1736541716295,
        update_at: 0,
        delete_at: 0,
        object_type: OBJECT_TYPE,
        attrs,
    } as unknown as PropertyField;
}

describe('Actions.patchSessionAttributeField', () => {
    const store = configureStore();

    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    it('patches the field and upserts the response into the store', async () => {
        const updated = makeField('field-1', {enabled: true, ttl_seconds: 3600, grace_period_seconds: 60});

        nock(Client4.getBaseRoute()).
            patch(`/properties/groups/${GROUP}/${OBJECT_TYPE}/fields/field-1`).
            reply(200, updated);

        const result = await store.dispatch(patchSessionAttributeField(GROUP, OBJECT_TYPE, 'field-1', {attrs: {ttl_seconds: 3600}}));

        expect(result.data).toEqual(updated);

        const state = store.getState() as GlobalState;
        expect(state.entities.properties.fields.byId['field-1']).toEqual(updated);
    });

    it('returns an error and does not upsert when the patch fails', async () => {
        nock(Client4.getBaseRoute()).
            patch(`/properties/groups/${GROUP}/${OBJECT_TYPE}/fields/field-missing`).
            reply(403, {message: 'forbidden'});

        const result = await store.dispatch(patchSessionAttributeField(GROUP, OBJECT_TYPE, 'field-missing', {attrs: {enabled: false}}));

        expect(result.error).toBeDefined();

        const state = store.getState() as GlobalState;
        expect(state.entities.properties.fields.byId['field-missing']).toBeUndefined();
    });
});
