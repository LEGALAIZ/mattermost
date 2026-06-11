// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {SESSION_ATTRIBUTES_GROUP_ID, SESSION_ATTRIBUTES_OBJECT_TYPE} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {getPropertyFieldsForObjectTypeAndGroup} from 'mattermost-redux/selectors/entities/properties';

import AdminHeader from 'components/widgets/admin_console/admin_header';

import {SESSION_ATTRIBUTES_TARGET_TYPE} from './utils';

import {AdminSection, AdminWrapper, SectionContent, SectionHeader, SectionHeading} from '../system_properties/controls';
import type {SearchableStrings} from '../types';

type Props = {
    disabled: boolean;
}

export default function SessionAttributesPage(props: Props) {
    const dispatch = useDispatch();

    const fields = useSelector((state: GlobalState) =>
        getPropertyFieldsForObjectTypeAndGroup(state, SESSION_ATTRIBUTES_OBJECT_TYPE, SESSION_ATTRIBUTES_GROUP_ID),
    );

    useEffect(() => {
        dispatch(fetchPropertyFields(SESSION_ATTRIBUTES_GROUP_ID, SESSION_ATTRIBUTES_OBJECT_TYPE, SESSION_ATTRIBUTES_TARGET_TYPE));
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
                        <div
                            data-testid='session_attributes_table_placeholder'
                            data-count={fields.length}
                            aria-disabled={props.disabled}
                        />
                    </SectionContent>
                </AdminSection>
            </AdminWrapper>
        </div>
    );
}

const msg = defineMessages({
    pageTitle: {id: 'admin.sidebar.sessionAttributes', defaultMessage: 'Session Attributes'},
});

export const searchableStrings: SearchableStrings = Object.values(msg);
