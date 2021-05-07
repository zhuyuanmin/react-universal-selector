import React, { Component } from 'react'
import { Modal, Tabs, Button, message } from 'antd'
import {ExclamationCircleFilled} from '@ant-design/icons'
import UniversalSelector from '../universal-selector'

import './index.less'

const { TabPane } = Tabs

/*  *
    * 使用示例
    *
    import MultiTabSelector from '@/views/components/multi-tab-selector'

    { visibleV && (
        <MultiTabSelector
            tabList={[
                {
                    name: '部门与成员',
                    key: '1',
                    checkedKeys: [],
                    fieldsMapping: {
                        key: 'department_id',
                        title: 'department_name',
                        path: 'department_path',
                        children: 'children'
                    },
                    needOutSidePath: false,
                    ableSearch: true,
                    checkStrictly: true,
                    checkLinkCancelNo: true,
                    showSelectAll: true,
                    extraFunction: () => {
                        return true
                    },
                    loadData: key => this.props.companyStore.getTreeItems(key, 0, 0, true, true),
                    searchData: word => this.props.companyStore.getObjByFuzzyName({
                        fuzzy_name: word,
                        type: 0
                    }, null, true, true),
                    treeData: [{
                        department_id: -1,
                        department_name: (this.props.companyStore.companyInfo || { enterprise_name: ''}).enterprise_name
                    }]
                },
                {
                    name: '费用类型',
                    key: '2',
                    title: '选择费用类型',
                    checkedKeys: [{
                        key: 12,
                        title: '其他',
                        fee_type: 12,
                        fee_name: '其他'
                    }],
                    fieldsMapping: {
                        key: 'fee_type',
                        title: 'fee_name',
                        children: 'item'
                    },
                    disabled: true,
                    hidden: false,
                    treeData: data,
                    checkStrictly: true,
                    isShowPath: false
                }
            ]}
            title={'选择部门与成员'}
            width={900}
            defaultTab="1"
            needSeparate // 数据隔离
            visible={this.state.visibleV}
            onOk={() => {}}
            onCancel={() => {
                this.setState({ visibleV: false })
            }}
        />
    ) }
*/

export default class MultiTabSelector extends Component {
  constructor(props) {
    super(props)

    const { defaultTab, tabList = [], needSeparate } = props
    const tabDataList = {}

    const newList = tabList.reduce((total, current) => {
      const { isShowPath = true, checkedKeys, key, fieldsMapping } = current
      const keys = checkedKeys.map(item => {
        return Object.assign(item, {
          tab: key,
          isShowPath,
          fieldsMapping,
        })
      })
      tabDataList[key] = keys
      return total.concat(keys)
    }, [])

    let activeKey = ''
    const nextTab = tabList.find(item => !item.hidden && !item.disabled)

    if (defaultTab) {
      const findTab = tabList.find(item => item.key === defaultTab)
      if (findTab && !findTab.hidden && !findTab.disabled) {
        activeKey = defaultTab
      } else {
        activeKey = nextTab ? nextTab.key : tabList[0].key
      }
    } else {
      activeKey = nextTab ? nextTab.key : tabList[0].key
    }

    this.state = {
      activeKey,
      tabDataList,
      selectList: needSeparate ? tabDataList[activeKey] : newList,
    }

    this.createRef = React.createRef()
  }

  onTabChange = activeKey => {
    const { tabDataList, activeKey: oldKey } = this.state
    const { tabList, needSeparate } = this.props
    const tabConfig = tabList.find(item => item.key === oldKey)

    if (needSeparate) {
      if (tabConfig && tabConfig.limitedNum) {
        if (tabDataList[oldKey].length > (tabConfig.limitedNum.limit || tabConfig.limitedNum)) {
          message.error(tabConfig.limitedNum.msg || `最多可选 ${tabConfig.limitedNum.limit || tabConfig.limitedNum} 个！`)
        } else {
          this.setState({ activeKey })
        }
        return
      }
      this.setState({ activeKey })
      return
    }

    this.setState({ activeKey })
  }

  // 监听子组件回调的数据
  noticeParentCallback = (selectedList, event) => {
    const { activeKey, tabDataList } = this.state
    const { tabList, needSeparate } = this.props

    if (event === 'deleteAll') {
      if (needSeparate) {
        tabDataList[activeKey] = []

        this.setState({
          tabDataList,
          selectList: [],
        })
      } else {
        this.setState({
          tabDataList: {},
          selectList: [],
        })
      }
      return
    }

    const ret = tabList.find(item => item.key === activeKey)
    const { isShowPath = true, fieldsMapping } = ret
    const listPlus = selectedList.map(item => {
      return Object.assign(item, {
        tab: activeKey,
        isShowPath,
        fieldsMapping,
      })
    })
    tabDataList[activeKey] = listPlus
    const selectList = [...Object.values(tabDataList).flat()]

    this.setState({
      tabDataList,
      selectList: needSeparate ? listPlus : selectList,
    })
  }

  onHandleOk = () => {
    const { selectList, tabDataList, activeKey } = this.state
    const { tabList, needSeparate, limitedNum } = this.props
    const existTabs = tabList.filter(item => !item.hidden)
    const existDataTabs = {}
    existTabs.forEach(item => {
      existDataTabs[item.key] = tabDataList[item.key]
    })
    const result = needSeparate ? existDataTabs : selectList
    const tabConfig = tabList.find(item => item.key === activeKey)

    if (needSeparate) {
      if (tabConfig && tabConfig.limitedNum) {
        if (tabDataList[activeKey].length > (tabConfig.limitedNum.limit || tabConfig.limitedNum)) {
          message.error(tabConfig.limitedNum.msg || `最多可选 ${tabConfig.limitedNum.limit || tabConfig.limitedNum} 个！`)
        } else {
          this.props.onOk(result, activeKey)
          this.onHandleCancel()
        }
        return
      }
      this.props.onOk(result, activeKey)
      this.onHandleCancel()
      return
    }

    if (limitedNum) {
      if (selectList.length > (limitedNum.limit || limitedNum)) {
        message.error(limitedNum.msg || `最多可选 ${limitedNum.limit || limitedNum} 个！`)
      } else {
        this.props.onOk(result, activeKey)
        this.onHandleCancel()
      }
      return
    }

    this.props.onOk(result, activeKey)
    this.onHandleCancel()
  }

  onHandleCancel = () => {
    this.props.onCancel()
  }

  onDeleteAll = () => {
    const { deleteAll } = this.createRef.current

    deleteAll('deleteAll')
  }

  onDeleteItem = (item, index) => {
    const { activeKey, tabDataList, selectList } = this.state

    if (item.tab === activeKey) {
      const { deleteItem } = this.createRef.current
      deleteItem(item, index)
    } else {
      const list = tabDataList[item.tab]
      const newList = list.filter(v => v.key !== item.key)
      selectList.splice(index, 1)
      tabDataList[item.tab] = newList

      this.setState({
        tabDataList,
        selectList: this.props.needSeparate ? newList : selectList,
      })
    }
  }

  render() {
    const { activeKey, selectList, tabDataList } = this.state
    const { tabList = [], title, width, visible } = this.props
    const newTitle = tabList.find(item => item.key === activeKey).title
    const defineTip = tabList.find(item => item.key === activeKey).defineTip || this.props.defineTip
    const showTabList = tabList.filter(item => !item.hidden)

    return (
      <Modal
        title={newTitle || title || '选择'}
        width={width}
        visible={visible}
        footer={null}
        onCancel={this.onHandleCancel}
        className="container-wrapper"
      >
        <div className="condition-edit-modal-container">
          {showTabList.length > 1 ? (
            <Tabs activeKey={activeKey} onChange={this.onTabChange} className="left-box">
              {showTabList.map(item => {
                const { name, key, disabled, fieldsMapping, treeData, checkedKeys, ...rest } = item

                return (
                  <TabPane tab={name} key={key} disabled={disabled}>
                    {activeKey === key && (
                      <UniversalSelector
                        visible={activeKey === key}
                        ref={this.createRef}
                        checkedKeys={tabDataList[key] || []}
                        fieldsMapping={fieldsMapping}
                        treeData={treeData}
                        showRightSelectorBox={false}
                        showSelectorDialog={false}
                        noticeParentCallback={this.noticeParentCallback}
                        {...rest}
                      />
                    )}
                  </TabPane>
                )
              })}
            </Tabs>
          ) : (
            <div className="left-box padding-24">
              {showTabList.map(item => {
                const { key, fieldsMapping, treeData, checkedKeys, ...rest } = item

                return (
                  <UniversalSelector
                    visible={activeKey === key}
                    key={key}
                    ref={this.createRef}
                    checkedKeys={tabDataList[key] || []}
                    fieldsMapping={fieldsMapping}
                    treeData={treeData}
                    showRightSelectorBox={false}
                    showSelectorDialog={false}
                    noticeParentCallback={this.noticeParentCallback}
                    {...rest}
                  />
                )
              })}
            </div>
          )}

          <div className="right-box">
            {defineTip && (
              <div className="tips">
                <ExclamationCircleFilled className="tips-icon" />
                <dd>{defineTip}</dd>
              </div>
            )}
            <div
              className="selected-bar"
              style={{ transform: defineTip ? 'translateY(34px)' : 'translateY(0)' }}
            >
              <div className="title">
                <span className="selected">
                  已选择 <span className="num">{selectList.length}</span> 项
                </span>
                <span className="delete" onClick={this.onDeleteAll}>
                  全部删除
                </span>
              </div>
              <div className="content-box" style={{ height: defineTip ? '440px' : '474px' }}>
                {selectList.map((item, index) => {
                  return (
                    <div className="checkbox-wrapper selected-box" key={item.key || index}>
                      <span
                        className={item.isExist === false ? 'selected-name gray' : 'selected-name'}
                      >
                        {item.isShowPath
                          ? item.path && !item.department_list
                            ? item.path
                            : item.title
                          : typeof item.title === 'object'
                            ? item[item.fieldsMapping.title]
                            : item.title}
                        {item.changeText}
                        {item.subTitle && <span className="sub-title">{item.subTitle}</span>}
                      </span>
                      <span
                        className="close-btn"
                        onClick={() => this.onDeleteItem(item, index)}
                      ></span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="btn-bar">
              <Button type="primary" onClick={this.onHandleOk}>
                确定
              </Button>
              <Button type="text" onClick={this.onHandleCancel}>
                取消
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    )
  }
}
