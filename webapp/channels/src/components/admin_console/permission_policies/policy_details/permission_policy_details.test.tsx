// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {useEnabledSessionAttributeFields} from 'hooks/useEnabledSessionAttributeFields';
import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';

import PermissionPolicyDetails from './permission_policy_details';

import CELEditor from '../../access_control/editors/cel_editor/editor';
import TableEditor from '../../access_control/editors/table_editor/table_editor';

jest.mock('utils/browser_history', () => ({
    getHistory: () => ({push: jest.fn()}),
}));

jest.mock('hooks/useEnabledSessionAttributeFields', () => ({
    useEnabledSessionAttributeFields: jest.fn(() => []),
}));

jest.mock('../../access_control/editors/table_editor/table_editor', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'table-editor'}));
});

jest.mock('../../access_control/editors/cel_editor/editor', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'cel-editor'}));
});

jest.mock('hooks/useChannelAccessControlActions', () => ({
    useChannelAccessControlActions: jest.fn(),
}));

const mockUseChannelAccessControlActions = useChannelAccessControlActions as jest.MockedFunction<typeof useChannelAccessControlActions>;
const mockUseEnabledSessionAttributeFields = useEnabledSessionAttributeFields as jest.MockedFunction<typeof useEnabledSessionAttributeFields>;
const MockedTableEditor = TableEditor as jest.MockedFunction<typeof TableEditor>;
const MockedCELEditor = CELEditor as jest.MockedFunction<typeof CELEditor>;

const SESSION_GROUP_UUID = 'nkpkzni6yjrjt8uktpbwkagoth';

const makeSessionField = (id: string, name: string): UserPropertyField => ({
    id,
    name,
    type: 'text',
    group_id: SESSION_GROUP_UUID,
    target_id: '',
    target_type: 'system',
    object_type: 'session',
    attrs: {
        sort_order: 0,
        visibility: 'always',
        value_type: '',
        enabled: true,
    } as UserPropertyField['attrs'],
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
});

describe('components/admin_console/permission_policies/policy_details/PermissionPolicyDetails', () => {
    const mockGetAccessControlFields = jest.fn();

    const baseProps = {
        accessControlSettings: {
            EnableAttributeBasedAccessControl: true,
            EnableUserManagedAttributes: false,
            TrustProxyDeviceIdentityHeader: false,
            EnforceDeviceIDConsistency: false,
        },
        sessionAttributesEnabled: true,
        actions: {
            fetchPolicy: jest.fn().mockResolvedValue({data: {}}),
            createPolicy: jest.fn().mockResolvedValue({data: {}}),
            deletePolicy: jest.fn().mockResolvedValue({data: {}}),
            setNavigationBlocked: jest.fn(),
        },
    };

    beforeEach(() => {
        // The CEL autocomplete endpoint returns only user/CPA attributes; session
        // attributes arrive separately via useEnabledSessionAttributeFields.
        mockGetAccessControlFields.mockResolvedValue({
            data: [
                {id: 'u1', name: 'department', group_id: 'cpa9q4w7m2x5c8v1b6n3k0jr5h', object_type: 'user', attrs: {managed: 'admin'}},
            ],
        });
        mockUseEnabledSessionAttributeFields.mockReturnValue([makeSessionField('s1', 'network_name')]);
        mockUseChannelAccessControlActions.mockReturnValue({
            getAccessControlFields: mockGetAccessControlFields,
            getVisualAST: jest.fn().mockResolvedValue({data: {}}),
            searchUsers: jest.fn(),
            getChannelPolicy: jest.fn(),
            saveChannelPolicy: jest.fn(),
            deleteChannelPolicy: jest.fn(),
            getChannelMembers: jest.fn(),
            createJob: jest.fn(),
            createAccessControlSyncJob: jest.fn(),
            validateExpressionAgainstRequester: jest.fn(),
            simulatePolicyForUsers: jest.fn(),
            updateAccessControlPoliciesActive: jest.fn(),
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('merges the fetched enabled session attributes into the table-mode picker', async () => {
        renderWithContext(<PermissionPolicyDetails {...baseProps}/>);

        await waitFor(() => {
            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        });

        expect(mockUseEnabledSessionAttributeFields).toHaveBeenCalledWith(true);

        const lastCall = MockedTableEditor.mock.calls[MockedTableEditor.mock.calls.length - 1][0];
        const passedNames = lastCall.userAttributes.map((attr) => attr.name);
        expect(passedNames).toContain('department');
        expect(passedNames).toContain('network_name');
    });

    test('includes session attributes in CEL mode even when user-managed attributes are disabled, carrying the object type', async () => {
        renderWithContext(<PermissionPolicyDetails {...baseProps}/>);

        await waitFor(() => {
            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByText('Switch to Advanced Mode'));

        await waitFor(() => {
            expect(screen.getByTestId('cel-editor')).toBeInTheDocument();
        });

        const lastCall = MockedCELEditor.mock.calls[MockedCELEditor.mock.calls.length - 1][0];
        const sessionEntry = lastCall.userAttributes.find((attr) => attr.attribute === 'network_name');
        expect(sessionEntry).toBeDefined();
        expect(sessionEntry?.objectType).toBe('session');
    });

    test('shows no session attributes when SessionAttributes is off', async () => {
        mockUseEnabledSessionAttributeFields.mockReturnValue([]);

        renderWithContext(
            <PermissionPolicyDetails
                {...baseProps}
                sessionAttributesEnabled={false}
            />,
        );

        await waitFor(() => {
            expect(screen.getByTestId('table-editor')).toBeInTheDocument();
        });

        expect(mockUseEnabledSessionAttributeFields).toHaveBeenCalledWith(false);

        const lastCall = MockedTableEditor.mock.calls[MockedTableEditor.mock.calls.length - 1][0];
        const passedNames = lastCall.userAttributes.map((attr) => attr.name);
        expect(passedNames).toEqual(['department']);
    });
});
