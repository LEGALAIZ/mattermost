// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {SESSION_ATTRIBUTES_GROUP_ID, SESSION_ATTRIBUTES_OBJECT_TYPE} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {getPropertyFieldsForObjectTypeAndGroup} from 'mattermost-redux/selectors/entities/properties';

import {setNavigationBlocked} from 'actions/admin_actions';

import LoadingScreen from 'components/loading_screen';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import SessionAttributesTable from './session_attributes_table';
import {useSessionAttributeEdits} from './use_session_attribute_edits';
import type {SessionAttributeEdits} from './use_session_attribute_edits';
import {SESSION_ATTRIBUTES_TARGET_TYPE} from './utils';
import type {SessionAttributeField} from './utils';

import SaveChangesPanel from '../save_changes_panel';
import {AdminSection, AdminWrapper, DangerText, SectionContent, SectionHeader, SectionHeading} from '../system_properties/controls';
import type {SearchableStrings} from '../types';

type Props = {
    disabled: boolean;
}

export default function SessionAttributesPage(props: Props) {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const [loaded, setLoaded] = useState(false);

    const fields = useSelector((state: GlobalState) =>
        getPropertyFieldsForObjectTypeAndGroup(state, SESSION_ATTRIBUTES_OBJECT_TYPE, SESSION_ATTRIBUTES_GROUP_ID),
    ) as SessionAttributeField[];

    const edits = useSessionAttributeEdits(fields);

    useEffect(() => {
        let active = true;
        Promise.resolve(dispatch(fetchPropertyFields(SESSION_ATTRIBUTES_GROUP_ID, SESSION_ATTRIBUTES_OBJECT_TYPE, SESSION_ATTRIBUTES_TARGET_TYPE))).
            finally(() => {
                if (active) {
                    setLoaded(true);
                }
            });
        return () => {
            active = false;
        };
    }, [dispatch]);

    useEffect(() => {
        dispatch(setNavigationBlocked(edits.hasChanges));
    }, [edits.hasChanges, dispatch]);

    return (
        <div
            className='wrapper--fixed'
            data-testid='sessionAttributes'
        >
            <AdminHeader>
                <FormattedMessage {...msg.pageTitle}/>
            </AdminHeader>
            <AdminWrapper>
                <AdminSection data-testid='session_attributes'>
                    <SectionHeader>
                        <hgroup>
                            <FormattedMessage
                                tagName={SectionHeading}
                                id='admin.session_attributes.configure.title'
                                defaultMessage='Configure session attributes'
                            />
                            <FormattedMessage
                                id='admin.session_attributes.configure.subtitle'
                                defaultMessage='Session attributes are evaluated per session and can be used in access control policies.'
                            />
                        </hgroup>
                    </SectionHeader>
                    <SectionContent $compact={true}>
                        <TableRegion aria-disabled={props.disabled}>
                            {renderRegion(loaded, edits)}
                        </TableRegion>
                    </SectionContent>
                </AdminSection>
            </AdminWrapper>
            <SaveChangesPanel
                saving={edits.saving}
                saveNeeded={edits.hasChanges}
                onClick={edits.save}
                onCancel={edits.cancel}
                isDisabled={props.disabled || edits.saving}
                savingMessage={formatMessage({id: 'admin.session_attributes.saving', defaultMessage: 'Saving…'})}
                serverError={edits.serverError ? (
                    <FormattedMessage
                        tagName={DangerText}
                        id='admin.session_attributes.save_error'
                        defaultMessage='There was an error while saving the session attributes'
                    />
                ) : undefined}
            />
        </div>
    );
}

function renderRegion(loaded: boolean, edits: SessionAttributeEdits) {
    if (!loaded) {
        return <LoadingScreen/>;
    }

    if (edits.merged.length === 0) {
        return (
            <EmptyState>
                <FormattedMessage
                    id='admin.session_attributes.empty'
                    defaultMessage='No session attributes found.'
                />
            </EmptyState>
        );
    }

    return (
        <SessionAttributesTable
            data={edits.merged}
            onStageChange={edits.stage}
        />
    );
}

const msg = defineMessages({
    pageTitle: {id: 'admin.sidebar.sessionAttributes', defaultMessage: 'Session Attributes'},
});

export const searchableStrings: SearchableStrings = Object.values(msg);

const TableRegion = styled.div`
    width: 100%;
`;

const EmptyState = styled.div`
    padding: 24px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    text-align: center;
`;
