// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {SESSION_ATTRIBUTES_GROUP_ID, SESSION_ATTRIBUTES_OBJECT_TYPE} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {getPropertyFieldsForObjectTypeAndGroup} from 'mattermost-redux/selectors/entities/properties';

import LoadingScreen from 'components/loading_screen';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import SessionAttributesTable from './session_attributes_table';
import {SESSION_ATTRIBUTES_TARGET_TYPE} from './utils';
import type {SessionAttributeField} from './utils';

import {AdminSection, AdminWrapper, SectionContent, SectionHeader, SectionHeading} from '../system_properties/controls';
import type {SearchableStrings} from '../types';

type Props = {
    disabled: boolean;
}

export default function SessionAttributesPage(props: Props) {
    const dispatch = useDispatch();

    const [loaded, setLoaded] = useState(false);

    const fields = useSelector((state: GlobalState) =>
        getPropertyFieldsForObjectTypeAndGroup(state, SESSION_ATTRIBUTES_OBJECT_TYPE, SESSION_ATTRIBUTES_GROUP_ID),
    ) as SessionAttributeField[];

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
                            {renderRegion(loaded, fields)}
                        </TableRegion>
                    </SectionContent>
                </AdminSection>
            </AdminWrapper>
        </div>
    );
}

function renderRegion(loaded: boolean, fields: SessionAttributeField[]) {
    if (!loaded) {
        return <LoadingScreen/>;
    }

    if (fields.length === 0) {
        return (
            <EmptyState>
                <FormattedMessage
                    id='admin.session_attributes.empty'
                    defaultMessage='No session attributes found.'
                />
            </EmptyState>
        );
    }

    return <SessionAttributesTable data={fields}/>;
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
