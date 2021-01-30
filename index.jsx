import React, { Component, Fragment } from 'react'
import { Modal, Checkbox, Tree, Button, Input, Spin } from 'antd'
import { FixedSizeList } from 'react-window'
import { LoadingOutlined, SearchOutlined } from '@ant-design/icons'
import { debounce } from '@/utils/throttle-debounce'
import PropTypes from 'prop-types'
import './index.less'

const antIcon = <LoadingOutlined style={{ fontSize: 24 }} spin />

/*  *
    * 使用示例
    *
    <UniversalSelector
        visible={feeTypeSelectorVisible}
        checkedKeys={[51]}
        fieldsMapping={{
            key: 'fee_type',
            title: 'fee_name',
            children: 'item'
        }}
        checkStrictly
        // onlySelectLeaf
        onlySelectParent
        // onlySelectOne
        // ableSearch
        // showSelectAll
        onOk={data => console.log(data)}
        onCancel={this.closeFeeTypeSelector}
        treeData={feeTypeData}
    />

    // 异步数据使用注意：1. 提供loadData(key)方法 2. 需求搜索功能提供searchData(name)方法 3. 回写请传数据对象
*/

const BATCH_NUM = 1000

class UniversalSelector extends Component {
    constructor(props) {
        super(props)
        this.onSearchChange = debounce(500, false, this.onSearchChange)
    }

    state = {
        loading: false,
        treeData2: [], // 处理过的数据
        checkedKeys2: [], // 当前选中keys
        onLoadData2: () => {}, // 异步加载函数
        selectedList: [], // 当前选中list
        tempTreeData: [], // 临时数据
        serializeData: [],
        checked: false,
        expandedKeys: [],
        tempExpandKeys: [],
        searchValue: '',
        autoExpandParent: true,
        noValidateData: []
    }

    componentDidMount() {
        const list = this.getInitDataList(this.props.treeData)
        const ret = this.getItemList({}, list, null)
        let res = []
        let checkedKeys = []

        if (this.props.checkedKeys.length > 0 && typeof this.props.checkedKeys[0] === 'object') {
            res = this.props.checkedKeys
            checkedKeys = res.map(item => String(item.key))

            if (!this.props.loadData) { // 异步数据无法判断数据是否发生变更
                const filterKeys = res.map(v => {
                    v.key = String(v.key)
                    return v
                }).filter(v => !Object.keys(ret).includes(v.key))
    
                if (filterKeys.length > 0) { // 过滤掉不存在 treeData 的 keys
                    checkedKeys = checkedKeys.filter(v => Object.keys(ret).includes(v)).map(v => String(v))
                    const noValidateData = filterKeys.map(v => (Object.assign({}, v, {
                        isExist: false,
                        title: v.title + '（' + this.props.title.substr(2) + '已变更）'
                    })))
                    res = checkedKeys.map(key => ret[key]).filter(v => v).concat(noValidateData)
                    this.setState({ noValidateData })
                } else {
                    res = checkedKeys.map(key => ret[key]).filter(v => v)
                }
            }
        } else {
            checkedKeys = this.isCheckStrictlyToCheck(this.props.checkedKeys.map(v => String(v)), ret)
            res = checkedKeys.map(key => ret[key]).filter(v => v)
        }

        this.setState({
            checkedKeys2: checkedKeys,
            selectedList: this.isOnlySelectLeaf(res),
            expandedKeys: (checkedKeys.length > 0 && !this.props.loadData) ? checkedKeys : list.map(item => item.key),
            serializeData: ret,
            notTreeData: this.props.notTreeData,
            loading: true,
            onLoadData2: this.onLoadData2,
        })

        let num = BATCH_NUM
        const step = () => {
            this.setState({
                treeData2: [...this.state.treeData2, ...list.slice(num - BATCH_NUM, num)],
            }, () => {
                num += BATCH_NUM
                if (this.state.treeData2.length < list.length) {
                    setTimeout(step, 500)
                } else {
                    this.setState({ loading: false })
                }
            })
        }
        step()
    }

    onLoadData2 = ({ key, children }) => {
        return new Promise(resolve => {
            if (children) {
                resolve()
                return
            }
            if (!this.props.loadData) {
                resolve()
                return
            }
            this.props.loadData(key).then(data => {
                function loop(dataArr) {
                    return dataArr.map(item => {
                        if (item.key === key) {
                            item.children = data
                            return item
                        }
                        if (item.children && item.children.length > 0) {
                            loop(item.children)
                        }
                        return item
                    })
                }

                const treeData2 = this.getInitDataList(loop(this.state.treeData2))
                this.setState({
                    serializeData: this.getItemList({}, treeData2, null),
                    treeData2,
                }, resolve)
            })
        })
    }

    getParentKey = (key, tree) => {
        let parentKey
        for (let i = 0; i < tree.length; i++) {
            const node = tree[i]
            if (node.children) {
                if (node.children.some(item => item.key === key)) {
                    parentKey = node.key
                } else if (this.getParentKey(key, node.children)) {
                    parentKey = this.getParentKey(key, node.children)
                }
            }
        }
        return parentKey
    }

    onExpand = expandedKeys => {
        this.setState({
            expandedKeys,
            autoExpandParent: false,
        })
    }

    // 搜索
    onSearchChange = value => {
        if (value.trim()) {
            if (this.props.searchData) {
                this.props.searchData(value.trim()).then(res => {
                    const treeData2 = this.getInitDataList(res)
                    if (this.state.tempTreeData.length === 0) {
                        this.setState({
                            tempTreeData: this.state.treeData2,
                            tempExpandKeys: this.state.expandedKeys,
                        })
                    }
                    this.setState({
                        treeData2,
                        serializeData: this.getItemList({}, treeData2, null),
                        notTreeData: true,
                    })
                })
            } else {
                const treeData2 = Object.keys(this.state.serializeData).map(key => this.state.serializeData[key])
                if (this.state.tempTreeData.length === 0) {
                    this.setState({
                        tempTreeData: this.state.treeData2,
                        tempExpandKeys: this.state.expandedKeys,
                    })
                }
                this.setState({
                    treeData2,
                    notTreeData: true
                })
            }
        } else {
            if (this.props.searchData) {
                this.setState({ serializeData: this.getItemList({}, this.state.tempTreeData, null) })
            }
            this.setState({
                treeData2: this.state.tempTreeData,
                tempTreeData: [],
                notTreeData: false,
            }, () => {
                this.setState({
                    expandedKeys: this.state.tempExpandKeys,
                    tempExpandKeys: [],
                })
            })
        }

        this.setState({
            searchValue: value.trim(),
            autoExpandParent: true,
        })
    }

    // 递归查询父节点
    getParentKeyItems = (arr, ret, key) => {
        if (ret[key].parentKey) {
            this.getParentKeyItems(arr, ret, ret[key].parentKey)
            arr.push(key)
        } else {
            arr.push(key)
        }
        return arr
    }

    // 递归查询子节点
    getChildrenKeyItems = (arr, ret, key) => {
        arr.push(key)
        if (ret[key].children && ret[key].children.length > 0) {
            ret[key].children.map(v => this.getChildrenKeyItems(arr, ret, v.key))
        }
        return arr
    }

    // 初始化原数据
    getInitDataList(arr = [], paths = null) {
        return arr.map(v => {
            const { key, title, path, children } = this.props.fieldsMapping
            let path2 = ''
            const arrPath = paths + '/' + v[title]
            if (v[path]) {
                path2 = v[path]
            } else if (paths) {
                const arrList = arrPath.split('/')
                arrList.shift()
                if (this.props.needOutSidePath === false) {
                    arrList.shift()
                }
                path2 = arrList.join('/')
            } else {
                path2 = v[title]
            }
            const newFiled = {
                key: String(v[key]),
                title: typeof title === 'string' ? v[title] : '',
                path: path2,
                children: v[children],
            }
            const newObj = {
                ...v,
                ...newFiled,
            }

            if (newObj.children && newObj.children.length > 0) {
                if (
                    this.props.onlySelectLeaf &&
                    (this.props.checkStrictly || this.props.onlySelectOne)
                ) {
                    // 不关联只选择叶子节点
                    newObj.checkable = false
                }
                newObj.children = this.getInitDataList(newObj.children, arrPath)
            } else {
                if (this.props.onlySelectParent) {
                    newObj.disabled = true
                }
            }

            if (!newObj.title) {
                newObj.title = title(newObj)
            }

            return newObj
        })
    }

    // 序列化原数据
    getItemList(obj, arr = [], parentKey) {
        arr.map(v => {
            if (v.children && v.children.length > 0) {
                obj[v.key] = Object.assign(v, { parentKey })
                this.getItemList(obj, v.children, v.key)
            } else {
                obj[v.key] = Object.assign(v, { parentKey })
            }
        })
        return obj
    }

    onSelect = (checkedKey, e) => {
        if (e.node.disabled || e.node.checkable === false) return
        let checkedKeys
        const ret = this.state.serializeData[e.node.key]
        if (this.props.checkStrictly || this.props.onlySelectParent || this.state.notTreeData) {
            const index = this.state.checkedKeys2.findIndex(key => key === ret.key)
            if (index > -1) {
                this.deleteItem(ret)
            } else {
                checkedKeys = [...this.state.checkedKeys2, ret.key]
                this.onCheck(checkedKeys, e)
            }
        } else {
            const result = this.getChildrenKeyItems([], this.state.serializeData, ret.key)
            const index = this.state.checkedKeys2.findIndex(key => key === ret.key)
            if (index > -1) {
                this.deleteItem(ret)
            } else {
                // 查找子节点是否全部被勾选，是则勾选父节点
                let pKeys
                if (ret.parentKey) {
                    pKeys = this.getChildrenKeyItems(
                        [],
                        this.state.serializeData,
                        ret.parentKey
                    ).filter(key => key !== ret.parentKey)
                }

                checkedKeys = [...new Set([...this.state.checkedKeys2, ...result])]
                if (pKeys && pKeys.every(key => checkedKeys.includes(key))) {
                    checkedKeys = [...checkedKeys, ret.parentKey]
                }

                this.onCheck(checkedKeys, e)
            }
        }
    }

    onCheck = (checkedKeys, e) => {
        const toDo = () => {
            const keys = this.isCheckStrictly(checkedKeys, e)
            const ret = keys.map(key => this.state.serializeData[key])

            this.setState({
                checkedKeys2: this.isOnlySelectOne(keys, e.node.key, true),
                selectedList: this.isOnlySelectOne(this.isOnlySelectLeaf(ret), e.node.key).concat(this.state.noValidateData),
            })

            if (keys.length !== Object.keys(this.state.serializeData).length) {
                this.setState({ checked: false })
            }

            if (keys.length === Object.keys(this.state.serializeData).length) {
                this.setState({ checked: true })
            }
        }

        // 如果只选择1项，并且存在已变更数据，则提示是否删除
        if (this.props.onlySelectOne && this.state.selectedList.length === 1 && this.state.checkedKeys2.length === 0) {
            if (this.props.extraFunction) {
                this.props.extraFunction(e, false).then(flag => {
                    if (flag) {
                        this.setState({
                            selectedList: [],
                            noValidateData: []
                        }, toDo)
                    }
                    
                })
            } else {
                this.setState({
                    selectedList: [],
                    noValidateData: []
                }, toDo)
            }
        } else {
            toDo()
        }
    }

    // 是否是单选处理
    isOnlySelectOne = (arr, key, flag) => {
        if (arr.length > 0 && this.props.onlySelectOne) {
            const ret = this.state.serializeData[key]
            if (this.props.onlySelectLeaf) {
                if (ret.children && ret.children.length > 0) return []
            }

            if (!flag) {
                return [ret]
            }
            return [key]
        }
        return arr
    }

    // 是否父子节点联动处理
    isCheckStrictly = (data, e) => {
        if (this.props.checkStrictly) {
            if (this.props.checkLinkCancelNo && (e.checked || e.selected !== undefined)) {
                const keys = this.getChildrenKeyItems([], this.state.serializeData, e.node.key)
                return [...new Set([...this.state.checkedKeys2, ...keys])]
            }
            return data.checked || data
        }
        return data
    }

    // 是否联动勾选逻辑
    isCheckStrictlyToCheck = (checkedKeys, ret) => {
        if (
            this.props.checkStrictly ||
            this.props.onlySelectParent ||
            this.props.onlySelectOne ||
            this.state.notTreeData
        ) {
            return checkedKeys
        }
        const keys = checkedKeys.map(key => {
            if (ret[key].parentKey) {
                const pKeys = this.getChildrenKeyItems([], ret, ret[key].parentKey).filter(
                    k => k !== ret[key].parentKey
                )
                if (pKeys && pKeys.every(k => checkedKeys.includes(k))) {
                    return [...this.getChildrenKeyItems([], ret, key), ret[key].parentKey]
                }
            }
            return this.getChildrenKeyItems([], ret, key)
        })
        return [...new Set(keys.flat())]
    }

    // 叶子节点处理
    isOnlySelectLeaf = arr => {
        if (this.props.onlySelectLeaf) {
            return arr.filter(v => !v.children)
        }
        return arr
    }

    // 删除单个选择
    deleteItem = (current, index) => {

        const dealTo = flag => {
            let items
            let keys
            if (flag) {
                items = this.state.selectedList.filter(item => item.key !== current.key)
                this.setState({ selectedList: items })
                return
            }
            if (this.props.checkStrictly) {
                items = this.state.selectedList.filter(item => item.key !== current.key)
                keys = this.state.checkedKeys2.filter(key => key !== current.key)
            } else {
                if (current.children && current.children.length > 0) {
                    const ret = this.getChildrenKeyItems([], this.state.serializeData, current.key)
                    const res = ret.map(v => this.state.serializeData[v])

                    items = this.state.selectedList.filter(item => res.every(k => k.key !== item.key))
                    keys = this.state.checkedKeys2.filter(key => ret.every(k => k !== key))
                }
                if (current.parentKey) {
                    const ret = this.getParentKeyItems([], this.state.serializeData, current.key)
                    const res = ret.map(v => this.state.serializeData[v])
                    items = items
                        ? items.filter(item => res.every(k => k.key !== item.key))
                        : this.state.selectedList.filter(item => res.every(k => k.key !== item.key))
                    keys = keys
                        ? keys.filter(key => ret.every(k => k !== key))
                        : this.state.checkedKeys2.filter(key => ret.every(k => k !== key))
                }
                items = items || this.state.selectedList.filter(item => item.key !== current.key)
                keys = keys || this.state.checkedKeys2.filter(key => key !== current.key)
            }

            this.setState({
                checkedKeys2: keys,
                selectedList: this.isOnlySelectLeaf(items),
            })

            if (keys.length !== Object.keys(this.state.serializeData).length) {
                this.setState({ checked: false })
            }
        }

        if (this.props.extraFunction) {
            this.props.extraFunction(current, current.isExist).then(flag => {
                if (flag) {
                    if (current.isExist === false) {
                        this.setState({
                            noValidateData: this.state.noValidateData.filter(v => v.key !== current.key)
                        }, () => {
                            dealTo(current.isExist)
                        })
                    } else {
                        dealTo(current.isExist)
                    }
                }
            })
        } else {
            dealTo(current.isExist)
        }
    }

    // 删除所有选择
    deleteAll = () => {
        const ret = this.state.selectedList.find(v => v.isExist === false)
        const dealTo = () => {
            this.setState({
                checkedKeys2: [],
                selectedList: [],
                checked: false,
            })
        }
        if (ret) {
            if (this.props.extraFunction) {
                this.props.extraFunction(this.state.selectedList, false).then(flag => {
                    if (flag) {
                        dealTo()
                        this.setState({
                            noValidateData: []
                        })
                    }
                })
            } else {
                dealTo()
            }
        } else {
            dealTo()
        }
    }

    // 全选
    onCheckAllChange = checked => {
        if (checked) {
            const keys = Object.keys(this.state.serializeData)
            const ret = this.isOnlySelectLeaf(Object.values(this.state.serializeData))
            this.setState({
                checkedKeys2: keys,
                selectedList: ret.concat(this.state.noValidateData),
                checked,
            })
        } else {
            this.deleteAll()
        }
    }

    // 确定
    handleOk = () => {
        const result = this.state.selectedList.map(item => {
            const { parentKey, key, title, children, ...rest } = item
            return { ...rest }
        })
        this.props.onOk(result)
        this.onCancel()
    }

    // 取消
    onCancel = () => {
        this.props.onCancel()
    }

    render() {
        const {
            title = '选择',
            width = 800,
            visible,
            onCancel,
            checkedKeys, // 组件状态自己维护， 舍弃
            treeData, // 组件状态自己维护， 舍弃
            loadData, // 组件状态自己维护， 舍弃
            showSelectAll,
            onlySelectOne,
            ableSearch,
            isShowPath = true,
            ...rest
        } = this.props
        const {
            loading,
            checkedKeys2,
            treeData2,
            onLoadData2,
            checked,
            serializeData,
            searchValue,
            expandedKeys,
            autoExpandParent,
            notTreeData,
        } = this.state

        const selectedList = this.state.selectedList.filter(v => v)

        const loop = data => {
            const result = data.map(item => {
                const showTitle = this.props.isShowPath === false ? item.title : item.path
                const index = showTitle && showTitle.toLocaleLowerCase().indexOf(searchValue.toLocaleLowerCase())
                const beforeStr = showTitle && showTitle.substr(0, index)
                const afterStr = showTitle && showTitle.substr(index + searchValue.length)
                const title8 = index > -1 ? (
                    <span>
                        {beforeStr}
                        <span className="site-tree-search-value">
                            {showTitle.slice(index, index + searchValue.length)}
                        </span>
                        {afterStr}
                    </span>
                ) : (
                    showTitle
                )

                if (item.children && !notTreeData) {
                    return { title: this.props.isShowPath === false ? title8 : item.title, key: item.key, children: loop(item.children) }
                }

                return {
                    title: this.props.isShowPath === false ? title8 : item.title,
                    path2: this.props.isShowPath === false ? item.title : item.path,
                    path: this.props.isShowPath === false ? item.path : title8,
                    key: item.key,
                }
            })
            
            if (notTreeData) {
                return result.filter(item => {
                    const showTitle = this.props.isShowPath === false ? item.title : item.path
                    return typeof showTitle !== 'string'
                })
            }
            return result
        }

        return (
            <Fragment>
                <Modal
                    title={title}
                    width={width}
                    visible={visible}
                    footer={null}
                    onCancel={onCancel}
                    className="universal-condition-edit-modal-wrapper"
                >
                    <div className="condition-edit-modal-container">
                        <div className={notTreeData ? 'left-box delete-node' : 'left-box'}>
                            {ableSearch && (
                                <Input
                                    style={{ marginBottom: 16, height: 40, color: '#C6CEDA' }}
                                    placeholder="搜索关键词"
                                    prefix={<SearchOutlined />}
                                    onChange={e => this.onSearchChange(e.target.value)}
                                    allowClear
                                />
                            )}
                            <div className="check-all-change">
                                {showSelectAll && !onlySelectOne && (
                                    <Checkbox
                                        onChange={e => this.onCheckAllChange(e.target.checked)}
                                        checked={checked}
                                        indeterminate={
                                            checkedKeys2.length > 0 &&
                                            checkedKeys2.length < Object.keys(serializeData).length
                                        }
                                    >
                                        全选
                                    </Checkbox>
                                )}
                            </div>
                            <Spin indicator={antIcon} spinning={loading}>
                                <RenderDOM
                                    loop={loop}
                                    notTreeData={notTreeData}
                                    ableSearch={ableSearch}
                                    onLoadData2={onLoadData2}
                                    onExpand={this.onExpand}
                                    expandedKeys={expandedKeys}
                                    autoExpandParent={autoExpandParent}
                                    checkedKeys2={checkedKeys2}
                                    treeData2={treeData2}
                                    isShowPath={isShowPath}
                                    showSelectAll={showSelectAll}
                                    onSelect={this.onSelect}
                                    onCheck={this.onCheck}
                                    {...rest}
                                />
                            </Spin>
                        </div>
                        <div className="right-box">
                            <div className="selected-bar">
                                <div className="title">
                                    <span className="selected">
                                        已选择 <span className="delete">{selectedList.length}</span>{' '}
                                        项
                                    </span>
                                    <span className="delete" onClick={this.deleteAll}>
                                        全部删除
                                    </span>
                                </div>
                                <div className="content-box">
                                    {selectedList.map((item, index) => {
                                        return (
                                            <div
                                                className="checkbox-wrapper selected-box"
                                                key={item.key}
                                            >
                                                <span className={item.isExist === false ? 'selected-name gray' : 'selected-name'}>{isShowPath ? (item.path || item.title) : item.title}</span>
                                                <span
                                                    className="close-btn"
                                                    onClick={() => this.deleteItem(item, index)}
                                                ></span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                            <div className="btn-bar">
                                <Button type="primary" onClick={this.handleOk}>
                                    确定
                                </Button>
                                <Button type="text" onClick={onCancel}>
                                    取消
                                </Button>
                            </div>
                        </div>
                    </div>
                </Modal>
            </Fragment>
        )
    }
}

const RenderDOM = props => {
    const {
        loop,
        notTreeData,
        ableSearch,
        onLoadData2,
        onExpand,
        expandedKeys,
        autoExpandParent,
        checkedKeys2,
        treeData2,
        onSelect,
        onCheck,
        isShowPath,
        showSelectAll,
        ...rest
    } = props
    if (notTreeData) {
        return (
            loop(treeData2).length > 0 ? (
                <FixedSizeList
                    height={showSelectAll ? 445 : 455}
                    itemCount={loop(treeData2).length}
                    itemSize={40}
                >
                    {
                        ({ index, style }) => {
                            const item = loop(treeData2)[index] || {}
                            return (
                                <div className="ul" style={style} title={item.path2}>
                                    <div className="box" key={item.key} onClick={e => {
                                        if (e.target.className === 'box' || e.target.parentElement.className === 'box' || e.target.parentElement.parentElement.className === 'box') {
                                            onSelect([], { node: { key: item.key } })
                                        }
                                    }}>
                                        <span className="title">{isShowPath ? item.path : item.title}</span>
                                        <Checkbox className="checkbox" checked={checkedKeys2.includes(item.key)} onChange={
                                            () => onSelect([], { node: { key: item.key } })
                                        } />
                                    </div>
                                </div>
                            )
                        }
                    }
                </FixedSizeList>
            ) : <span>未匹配到搜索结果</span>
        )
    }
    if (ableSearch) {
        return (
            <Tree
                checkable
                blockNode
                loadData={onLoadData2}
                onExpand={onExpand}
                expandedKeys={expandedKeys}
                autoExpandParent={autoExpandParent}
                checkedKeys={checkedKeys2}
                treeData={loop(treeData2)}
                onSelect={onSelect}
                onCheck={onCheck}
                height={showSelectAll ? 444 : 467}
                virtual
                {...rest}
            />
        )
    }
    return (
        <Tree
            key={JSON.stringify(treeData2)} // 触发重新渲染
            defaultExpandAll
            checkable
            blockNode
            loadData={onLoadData2}
            checkedKeys={checkedKeys2}
            treeData={treeData2}
            onSelect={onSelect}
            onCheck={onCheck}
            height={showSelectAll ? 500 : 523}
            virtual
            {...rest}
        />
    )
}

UniversalSelector.propTypes = {
    title: PropTypes.string,
    width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    visible: PropTypes.bool.isRequired,
    onOk: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    isShowPath: PropTypes.bool, // 是否展示节点的完整路径
    needOutSidePath: PropTypes.bool, // 是否拼接最外层路径
    onlySelectLeaf: PropTypes.bool, // 是否只选择叶子节点
    onlySelectParent: PropTypes.bool, // 是否只选择父节点
    onlySelectOne: PropTypes.bool, // 是否单选
    showSelectAll: PropTypes.bool, // 是否显示全选
    fieldsMapping: PropTypes.object.isRequired, // 字段映射规则
    searchData: PropTypes.func, // 异步数据筛选方法
    ableSearch: PropTypes.bool, // 是否可以搜索节点
    notTreeData: PropTypes.bool, // 是否是树结构数据
    checkLinkCancelNo: PropTypes.bool, // 勾选联动，取消不联动
    extraFunction: PropTypes.func, // 删除勾选前处理函数
}

export default UniversalSelector
