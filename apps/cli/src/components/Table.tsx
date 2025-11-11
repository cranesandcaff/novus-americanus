import React, { JSX, useMemo } from 'react'
import { Box, Text } from 'ink'
import { sha1 } from 'object-hash'

type Scalar = string | number | boolean | null | undefined

type ScalarDict = {
	[key: string]: Scalar
}

export type CellProps = React.PropsWithChildren<{ column: number }>

export type TableProps<T extends ScalarDict> = {
	data: T[]
	columns?: (keyof T)[]
	padding?: number
	header?: (props: React.PropsWithChildren<{}>) => JSX.Element
	cell?: (props: CellProps) => JSX.Element
	skeleton?: (props: React.PropsWithChildren<{}>) => JSX.Element
}

type Column<T> = {
	key: string
	column: keyof T
	width: number
}

type RowConfig = {
	cell: (props: CellProps) => JSX.Element
	padding: number
	skeleton: {
		component: (props: React.PropsWithChildren<{}>) => JSX.Element
		left: string
		right: string
		cross: string
		line: string
	}
}

type RowProps<T extends ScalarDict> = {
	key: string
	data: Partial<T>
	columns: Column<T>[]
}

function intersperse<T, I>(
	intersperser: (index: number) => I,
	elements: T[],
): (T | I)[] {
	if (elements.length === 0) {
		return []
	}

	return elements.reduce((acc, element, index) => {
		if (acc.length === 0) {
			return [element]
		}
		return [...acc, intersperser(index), element]
	}, [] as (T | I)[])
}

function row<T extends ScalarDict>(
	config: RowConfig,
): (props: RowProps<T>) => JSX.Element {
	const skeleton = config.skeleton

	return (props) => (
		<Box flexDirection="row">
			<skeleton.component>{skeleton.left}</skeleton.component>
			{...intersperse(
				(i) => {
					const key = `${props.key}-hseparator-${i}`
					return (
						<skeleton.component key={key}>{skeleton.cross}</skeleton.component>
					)
				},
				props.columns.map((column, colI) => {
					const value = props.data[column.column]

					if (value == undefined || value == null) {
						const key = `${props.key}-empty-${column.key}`
						return (
							<config.cell key={key} column={colI}>
								{skeleton.line.repeat(column.width)}
							</config.cell>
						)
					}

					const key = `${props.key}-cell-${column.key}`
					const ml = config.padding
					const mr = column.width - String(value).length - config.padding

					return (
						<config.cell key={key} column={colI}>
							{`${skeleton.line.repeat(ml)}${String(value)}${skeleton.line.repeat(mr)}`}
						</config.cell>
					)
				}),
			)}
			<skeleton.component>{skeleton.right}</skeleton.component>
		</Box>
	)
}

export function Header(props: React.PropsWithChildren<{}>) {
	return (
		<Text bold color="blue">
			{props.children}
		</Text>
	)
}

export function Cell(props: CellProps) {
	return <Text>{props.children}</Text>
}

export function Skeleton(props: React.PropsWithChildren<{}>) {
	return <Text bold>{props.children}</Text>
}

function getDataKeys<T extends ScalarDict>(data: T[]): (keyof T)[] {
	const keys = new Set<keyof T>()

	for (const item of data) {
		for (const key in item) {
			keys.add(key)
		}
	}

	return Array.from(keys)
}

function getColumns<T extends ScalarDict>(
	data: T[],
	columns: (keyof T)[],
	padding: number,
): Column<T>[] {
	return columns.map((key) => {
		const header = String(key).length
		const cellWidths = data.map((item) => {
			const value = item[key]

			if (value == undefined || value == null) {
				return 0
			}

			return String(value).length
		})

		const width = Math.max(...cellWidths, header) + padding * 2

		return {
			column: key,
			width: width,
			key: String(key),
		}
	})
}

function getHeadings<T extends ScalarDict>(columns: (keyof T)[]): Partial<T> {
	return columns.reduce(
		(acc, column) => ({ ...acc, [column]: column }),
		{},
	)
}

export default function Table<T extends ScalarDict>({
	data,
	columns: columnsProp,
	padding = 1,
	header: headerComponent = Header,
	cell: cellComponent = Cell,
	skeleton: skeletonComponent = Skeleton,
}: TableProps<T>) {
	const columns = useMemo(
		() => columnsProp || getDataKeys(data),
		[columnsProp, data],
	)

	const columnWidths = useMemo(
		() => getColumns(data, columns, padding),
		[data, columns, padding],
	)

	const headings = useMemo(() => getHeadings(columns), [columns])

	const baseRowConfig = useMemo(
		() => ({
			padding,
			component: skeletonComponent,
		}),
		[padding, skeletonComponent],
	)

	const headerRow = useMemo(
		() =>
			row<T>({
				cell: skeletonComponent,
				padding,
				skeleton: {
					component: skeletonComponent,
					line: '─',
					left: '┌',
					right: '┐',
					cross: '┬',
				},
			}),
		[baseRowConfig],
	)

	const headingRow = useMemo(
		() =>
			row<T>({
				cell: headerComponent,
				padding,
				skeleton: {
					component: skeletonComponent,
					line: ' ',
					left: '│',
					right: '│',
					cross: '│',
				},
			}),
		[padding, headerComponent, skeletonComponent],
	)

	const separatorRow = useMemo(
		() =>
			row<T>({
				cell: skeletonComponent,
				padding,
				skeleton: {
					component: skeletonComponent,
					line: '─',
					left: '├',
					right: '┤',
					cross: '┼',
				},
			}),
		[baseRowConfig],
	)

	const dataRow = useMemo(
		() =>
			row<T>({
				cell: cellComponent,
				padding,
				skeleton: {
					component: skeletonComponent,
					line: ' ',
					left: '│',
					right: '│',
					cross: '│',
				},
			}),
		[padding, cellComponent, skeletonComponent],
	)

	const footerRow = useMemo(
		() =>
			row<T>({
				cell: skeletonComponent,
				padding,
				skeleton: {
					component: skeletonComponent,
					line: '─',
					left: '└',
					right: '┘',
					cross: '┴',
				},
			}),
		[baseRowConfig],
	)

	return (
		<Box flexDirection="column">
			{headerRow({ key: 'header', columns: columnWidths, data: {} })}
			{headingRow({ key: 'heading', columns: columnWidths, data: headings })}
			{data.map((rowData, index) => {
				const key = `row-${sha1(rowData)}-${index}`
				return (
					<Box flexDirection="column" key={key}>
						{separatorRow({
							key: `separator-${key}`,
							columns: columnWidths,
							data: {},
						})}
						{dataRow({ key: `data-${key}`, columns: columnWidths, data: rowData })}
					</Box>
				)
			})}
			{footerRow({ key: 'footer', columns: columnWidths, data: {} })}
		</Box>
	)
}
