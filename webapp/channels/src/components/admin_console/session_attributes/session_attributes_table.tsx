// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef} from '@tanstack/react-table';
import type {ComponentType} from 'react';
import React, {useMemo} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';
import styled from 'styled-components';

import {CheckboxMarkedCircleOutlineIcon, ChevronDownCircleOutlineIcon, MapMarkerOutlineIcon, MenuVariantIcon, UpdateIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';

import PlatformIcons from './platform_icons';
import SessionAttributesDotMenu from './session_attributes_dot_menu';
import StatusChip from './status_chip';
import type {StagedAttrs} from './use_session_attribute_edits';
import type {SessionAttributeDisplayType, SessionAttributeField} from './utils';
import {formatDuration, getDisplayType, getSessionAttrs, getSessionDisplayName, isServerSourced} from './utils';

import {AdminConsoleListTable} from '../list_table';

const columnHelper = createColumnHelper<SessionAttributeField>();

const TYPE_ICONS: Record<SessionAttributeDisplayType, ComponentType<IconProps>> = {
    String: MenuVariantIcon,
    IP: MapMarkerOutlineIcon,
    Boolean: CheckboxMarkedCircleOutlineIcon,
    Version: UpdateIcon,
    Enum: ChevronDownCircleOutlineIcon,
};

type Props = {
    data: SessionAttributeField[];
    onStageChange: (fieldId: string, partial: StagedAttrs) => void;
};

export default function SessionAttributesTable({data, onStageChange}: Props) {
    const rows = useMemo(
        () => [...data].sort((a, b) => ((a.attrs?.sort_order ?? 0) - (b.attrs?.sort_order ?? 0)) || a.name.localeCompare(b.name)),
        [data],
    );

    const columns = useMemo<Array<ColumnDef<SessionAttributeField, any>>>(() => {
        return [
            columnHelper.accessor((row) => getSessionDisplayName(row), {
                id: 'display_name',
                size: 200,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage
                            id='admin.session_attributes.table.display_name'
                            defaultMessage='Display Name'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({getValue}) => (
                    <DisplayName data-testid='session-attribute-display-name'>
                        {getValue()}
                    </DisplayName>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.accessor('name', {
                size: 180,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage
                            id='admin.session_attributes.table.name'
                            defaultMessage='Name'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({getValue, row}) => (
                    <NameCell>
                        <NameText>{getValue()}</NameText>
                        {isServerSourced(row.original.name) && (
                            <ServerBadge data-testid='session-attribute-server-label'>
                                <FormattedMessage
                                    id='admin.session_attributes.table.server_label'
                                    defaultMessage='Server'
                                />
                            </ServerBadge>
                        )}
                    </NameCell>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.accessor((row) => getDisplayType(row), {
                id: 'type',
                size: 120,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage
                            id='admin.session_attributes.table.type'
                            defaultMessage='Type'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({getValue}) => {
                    const displayType = getValue<SessionAttributeDisplayType>();
                    const Icon = TYPE_ICONS[displayType];

                    return (
                        <TypeCell data-testid='session-attribute-type'>
                            <Icon size={16}/>
                            <FormattedMessage {...typeLabels[displayType]}/>
                        </TypeCell>
                    );
                },
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.display({
                id: 'platform',
                size: 120,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage
                            id='admin.session_attributes.table.platform'
                            defaultMessage='Platform'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({row}) => (
                    <PlatformIcons platforms={getSessionAttrs(row.original).platforms}/>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.display({
                id: 'ttl',
                size: 80,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage
                            id='admin.session_attributes.table.ttl'
                            defaultMessage='TTL'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({row}) => (
                    <DurationText data-testid='session-attribute-ttl'>
                        {formatDuration(getSessionAttrs(row.original).ttl_seconds)}
                    </DurationText>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.display({
                id: 'grace',
                size: 80,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage
                            id='admin.session_attributes.table.grace'
                            defaultMessage='Grace'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({row}) => (
                    <DurationText data-testid='session-attribute-grace'>
                        {formatDuration(getSessionAttrs(row.original).grace_period_seconds)}
                    </DurationText>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.display({
                // Not named 'status' because that class name collides with the
                // global user status indicator styles (see _status-icon.scss),
                // which add unwanted margin to this column.
                id: 'sessionStatus',
                size: 104,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage
                            id='admin.session_attributes.table.status'
                            defaultMessage='Status'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({row}) => (
                    <StatusChip enabled={getSessionAttrs(row.original).enabled}/>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.display({
                id: 'actions',
                size: 56,
                header: () => (
                    <ColHeaderRight>
                        <FormattedMessage
                            id='admin.session_attributes.table.actions'
                            defaultMessage='Actions'
                        />
                    </ColHeaderRight>
                ),
                cell: ({row}) => (
                    <ActionsRoot>
                        <SessionAttributesDotMenu
                            field={row.original}
                            onStageChange={onStageChange}
                        />
                    </ActionsRoot>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
        ];
    }, [onStageChange]);

    const table = useReactTable<SessionAttributeField>({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel<SessionAttributeField>(),
        getSortedRowModel: getSortedRowModel<SessionAttributeField>(),
        enableSortingRemoval: false,
        enableMultiSort: false,
        renderFallbackValue: '',
        meta: {tableId: 'sessionAttributes', disablePaginationControls: true},
        manualPagination: true,
        enableColumnPinning: false,
    });

    return (
        <TableWrapper $minWidth={table.getTotalSize()}>
            <AdminConsoleListTable<SessionAttributeField> table={table}/>
        </TableWrapper>
    );
}

const typeLabels = defineMessages({
    String: {id: 'admin.session_attributes.type.string', defaultMessage: 'String'},
    IP: {id: 'admin.session_attributes.type.ip', defaultMessage: 'IP'},
    Boolean: {id: 'admin.session_attributes.type.boolean', defaultMessage: 'Boolean'},
    Version: {id: 'admin.session_attributes.type.version', defaultMessage: 'Version'},
    Enum: {id: 'admin.session_attributes.type.enum', defaultMessage: 'Enum'},
});

const TableWrapper = styled.div<{$minWidth: number}>`
    .adminConsoleListTableContainer {
        overflow-x: auto;
        padding: 2px 0;
    }

    table.adminConsoleListTable {
        width: max-content;
        max-width: 100%;
        min-width: ${({$minWidth}) => $minWidth}px;

        td, th {
            &:after, &:before {
                display: none !important;
            }
        }

        thead {
            border-top: none;
            border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
            tr {
                th {
                    background: rgba(var(--center-channel-color-rgb), 0.04);
                    padding-block-end: 8px;
                    padding-block-start: 8px;
                }
            }
        }

        tbody {
            tr {
                border-top: none;
                border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
                border-bottom-color: rgba(var(--center-channel-color-rgb), 0.08) !important;
                td {
                    &:last-child {
                        padding-inline-end: 12px;
                    }
                }
            }
        }

        tfoot {
            border-top: none;
        }
    }
`;

const ColHeaderLeft = styled.div`
    display: inline-block;
`;

const ColHeaderRight = styled.div`
    display: inline-block;
    width: 100%;
    text-align: right;
`;

const DisplayName = styled.span`
    font-size: 14px;
    font-weight: 600;
`;

const NameCell = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 8px;
`;

const NameText = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.75);
    font-family: 'Menlo', 'Monaco', monospace;
    font-size: 12px;
`;

const ServerBadge = styled.span`
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    color: rgba(var(--center-channel-color-rgb), 0.75);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
`;

const TypeCell = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: rgba(var(--center-channel-color-rgb), 0.75);

    svg {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

const DurationText = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.75);
`;

const ActionsRoot = styled.div`
    display: flex;
    justify-content: flex-end;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;
