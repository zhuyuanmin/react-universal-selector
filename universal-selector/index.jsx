import React, { Component, Fragment } from 'react'
import { Modal, Checkbox, Tree, Button, Input, Spin, message } from 'antd'
import { FixedSizeList } from 'react-window'
import { LoadingOutlined, SearchOutlined, ExclamationCircleFilled } from '@ant-design/icons'
import { debounce } from '@/utils/throttle-debounce'
import PropTypes from 'prop-types'
import './index.less'

const antIcon = <LoadingOutlined style={{ fontSize: 24 }} spin />

/*  *
    * 使用示例
    *
    import UniversalSelector from '@/views/components/universal-selector'

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
    noValidateData: [],
  }

  componentDidMount() {
    const list = this.getInitDataList(this.props.treeData)
    const ret = this.getItemList({}, list, null)
    let res = []
    let checkedKeys = []

    if (this.props.checkedKeys.length > 0 && typeof this.props.checkedKeys[0] === 'object') {
      res = this.props.checkedKeys.map(item => ({
        ...item,
        key: String(item.key),
      }))
      checkedKeys = res.map(item => item.key)

      if (!this.props.loadData) {
        // 异步数据无法判断数据是否发生变更
        const filterKeys = res.filter(v => !Object.keys(ret).includes(v.key))

        if (filterKeys.length > 0) {
          // 过滤掉不存在 treeData 的 keys
          checkedKeys = checkedKeys.filter(v => Object.keys(ret).includes(v)).map(v => String(v))
          const noValidateData = filterKeys.map(v => {
            return Object.assign({}, v, {
              isExist: false,
              changeText: `（${(this.props.title || '').substr(2)}已变更）`,
            })
          })
          res = checkedKeys
            .map(key => ret[key])
            .filter(v => v)
            .concat(noValidateData)
          this.setState({ noValidateData })
        } else {
          res = checkedKeys.map(key => ret[key]).filter(v => v)
        }
      }
    } else {
      checkedKeys = this.props.checkedKeys.filter(key => ret[key]).map(v => String(v))
      checkedKeys = this.isCheckStrictlyToCheck(checkedKeys, ret)
      res = checkedKeys.map(key => ret[key]).filter(v => v)
    }

    this.setState({
      checkedKeys2: checkedKeys,
      selectedList: this.isOnlySelectLeaf(res),
      expandedKeys:
        checkedKeys.length > 0 && !this.props.loadData ? checkedKeys : list[0] ? [list[0].key] : [],
      serializeData: ret,
      notTreeData: this.props.notTreeData,
      loading: true,
      onLoadData2: this.onLoadData2,
    })

    this.props.noticeParentCallback && this.props.noticeParentCallback(this.isOnlySelectLeaf(res))

    let num = BATCH_NUM
    const step = () => {
      const { treeData2 } = this.state
      this.setState(
        {
          treeData2: [...treeData2, ...list.slice(num - BATCH_NUM, num)],
        },
        () => {
          num += BATCH_NUM
          if (this.state.treeData2.length < list.length) {
            setTimeout(step, 500)
          } else {
            this.setState({ loading: false })
          }
        }
      )
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
        //! data 有两种情况 1、只有部门数据[]  2、有部门数据和人员数据{dept: [], member: []}，此情况含有定制化内容
        const { key: k } = this.props.fieldsMapping || {}
        const newArr = data
          ? Array.isArray(data)
            ? data
            : [
              ...(data.dept || []),
              ...(data.member || []).map(item => ({ ...item, [k]: key, isLeaf: true })),
            ]
          : []

        function loop(dataArr) {
          return dataArr.map(item => {
            if (item.key === key) {
              item.children = newArr
              return item
            }
            if (item.children && item.children.length > 0) {
              loop(item.children)
            }
            return item
          })
        }

        const treeData = this.state.treeData2
        const treeData2 = this.getInitDataList(loop(treeData))
        const ret = this.getItemList({}, treeData2, null)
        const retKeys = this.state.checkedKeys2.map(keys => {
          const pKey = keys.split('#')[1] ? keys.split('#')[1] : keys
          if (!Object.keys(ret).includes(pKey)) {
            const dKeys = Object.keys(ret).filter(v => v.indexOf('#') > -1)
            return dKeys.filter(v => v.split('#')[1] === pKey)
          }
          return keys
        })
        const checkedKeys2 = [...new Set(retKeys.flat())]
        const noExistKeys = this.state.checkedKeys2.filter(keys => {
          const pKey = keys.split('#')[1] ? keys.split('#')[1] : keys
          const arrKey = checkedKeys2.map(keyss => {
            return keyss.split('#')[1] ? keyss.split('#')[1] : keyss
          })
          return !arrKey.includes(pKey)
        })
        const noExistList = this.state.selectedList.filter(item => {
          const pKey = item.key.split('#')[1] ? item.key.split('#')[1] : item.key
          const arrKey = noExistKeys.map(keys => {
            return keys.split('#')[1] ? keys.split('#')[1] : keys
          })
          return arrKey.includes(pKey)
        })

        const selectedList = this.selectListToDo(checkedKeys2.map(v => ret[v])).concat(noExistList)
        const checkedKeys = selectedList.map(item => {
          if (item.department_list && item.department_list.length > 0) {
            return item.department_list.map(v => `${v.department_id}#${item.key.split('#')[1] ? item.key.split('#')[1] : item.key}`)
          }
          return item.key
        })
        const checkedKeys3 = [...new Set(checkedKeys.flat())]

        this.setState(
          {
            serializeData: ret,
            checkedKeys2: checkedKeys3,
            treeData2,
            selectedList,
          },
          resolve
        )

        this.props.noticeParentCallback && this.props.noticeParentCallback(selectedList)
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
          const newArr = res
            ? Array.isArray(res)
              ? res
              : [
                ...(res.dept || []),
                ...(res.member || []).map(item => ({ ...item, isLeaf: true })),
              ]
            : []
          const treeData2 = this.getInitDataList(newArr, null, true)
          const treeData = this.state.treeData2
          const expandedKeys = this.state.expandedKeys
          const checkedKeys = this.state.checkedKeys2
          if (this.state.tempTreeData.length === 0) {
            this.setState({
              tempTreeData: treeData,
              tempExpandKeys: expandedKeys,
            })
          }
          const checkedKeys2 = checkedKeys.map(key => {
            return key.indexOf('#') > -1 ? key.split('#')[1] : key
          })
          this.setState({
            treeData2,
            checkedKeys2,
            serializeData: this.getItemList({}, treeData2, null),
            notTreeData: true,
          })
        })
      } else {
        const { serializeData, expandedKeys } = this.state
        const treeData = this.state.treeData2
        const treeData2 = Object.keys(serializeData).map(key => this.state.serializeData[key])
        if (this.state.tempTreeData.length === 0) {
          this.setState({
            tempTreeData: treeData,
            tempExpandKeys: expandedKeys,
          })
        }
        this.setState({
          treeData2,
          notTreeData: true,
        })
      }
    } else {
      const ret = this.getItemList({}, this.state.tempTreeData, null)

      if (this.props.searchData) {
        this.setState({ serializeData: ret })
      }

      const filterArr = this.state.selectedList.filter(v => {
        const arr = this.state.checkedKeys2.filter(key => {
          const keys = Object.keys(this.state.serializeData).map(k => {
            return k.split('#')[1] ? k.split('#')[1] : k
          })
          return ![...new Set(keys)].includes(key)
        })
        return arr.includes(v.key) || (v.key.split('#')[1] && arr.includes(v.key.split('#')[1]))
      })

      const retKeys = this.state.checkedKeys2.map(keys => {
        if (!Object.keys(ret).includes(keys)) {
          const dKeys = Object.keys(ret).filter(v => v.indexOf('#') > -1)
          return dKeys.filter(v => v.split('#')[1] === keys)
        }
        return keys
      })
      const arrList = filterArr.concat([...new Set(retKeys.flat())].map(v => ret[v]))
      const selectedList = this.selectListToDo(arrList)
      const checkedKeys2 = filterArr.map(v => v.key).concat([...new Set(retKeys.flat())])
      const { tempTreeData, tempExpandKeys } = this.state
      this.setState(
        {
          treeData2: tempTreeData,
          tempTreeData: [],
          notTreeData: false,
          checkedKeys2,
          selectedList,
        },
        () => {
          this.setState({
            expandedKeys: tempExpandKeys,
            tempExpandKeys: [],
          })
        }
      )

      this.props.noticeParentCallback && this.props.noticeParentCallback(selectedList)
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
  getInitDataList(arr = [], paths = null, flag) {
    return arr.map(v => {
      const { key: key2, title: title2, path, children = 'children', showTitle, render } =
        this.props.fieldsMapping || {}
      let path2 = ''
      const arrPath = `${paths}/${v[title2] || v.title}`
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
        path2 = v[title2] || v.title
      }
      const newFiled = {
        key: v[key2] ? String(v[key2]) : v.key,
        title: typeof title2 === 'string' && v[title2] ? v[title2] : v.title,
        path: path2,
        children: v[children],
        render,
      }
      const newObj = {
        ...v,
        ...newFiled,
        showTitle: v.showTitle || showTitle,
      }

      if (newObj.children && newObj.children.length > 0) {
        if (this.props.onlySelectLeaf && (this.props.checkStrictly || this.props.onlySelectOne)) {
          // 不关联只选择叶子节点
          newObj.checkable = false
        }
        newObj.children = this.getInitDataList(newObj.children, arrPath)
      } else if (this.props.onlySelectParent) {
        newObj.disabled = true
      }

      if (this.props.onlyChooseMember) {
        if (!newObj.isLeaf) {
          newObj.checkable = false
        }
      }

      if (newObj.showTitle) {
        if (typeof newObj.showTitle === 'function') {
          newObj.title = newObj.showTitle(newObj)
        } else {
          newObj.title = newObj.showTitle
        }
      }

      if (newObj.render && typeof newObj.render === 'function') {
        const result = newObj.render(newObj)
        if (flag) {
          return Object.assign(result, {
            key: result.key.split('#')[1] ? result.key.split('#')[1] : result.key,
          })
        }
        return result
      }

      return newObj
    })
  }

  // 序列化原数据
  getItemList(obj, arr = [], parentKey) {
    arr.map(v => {
      if (v.children && v.children.length > 0) {
        obj[v.key] = Object.assign(v, { parentKey, key: String(v.key) })
        this.getItemList(obj, v.children, v.key)
      } else {
        obj[v.key] = Object.assign(v, { parentKey, key: String(v.key) })
      }
      return v
    })
    return obj
  }

  onSelect = (checkedKey, e) => {
    if (e.node.disabled) return
    if (e.node.checkable === false) {
      if (!this.props.notTreeData) {
        let { expandedKeys } = this.state
        const ret = expandedKeys.find(key => key === e.node.key)
        if (ret) {
          // 判断是否有子级展开，有的话全部得过滤掉
          const arr = this.getChildrenKeyItems([], this.state.serializeData, e.node.key)
          expandedKeys = expandedKeys.filter(key => !arr.includes(key))
        } else {
          expandedKeys = [...expandedKeys, e.node.key]
        }
        this.setState({
          expandedKeys,
        })
      }
      return
    }

    let checkedKeys
    const ret = this.state.serializeData[e.node.key]
    if (!ret) return
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
          pKeys = this.getChildrenKeyItems([], this.state.serializeData, ret.parentKey).filter(
            key => key !== ret.parentKey
          )
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
      let keys = []
      const keys0 = this.isCheckStrictly(checkedKeys, e)
      if (!this.state.notTreeData) {
        if (e.checked || e.selected !== undefined) {
          // 选中
          const keys2 = keys0.filter(key => key.indexOf('#') === -1)
          const employeeKeys = keys0
            .filter(key => key.indexOf('#') > -1)
            .map(key => {
              const ret = this.state.serializeData[key]
              const dKeys = ret
                ? (ret.department_list || []).map(v => `${v.department_id}#${ret.key.split('#')[1] ? ret.key.split('#')[1] : ret.key}`)
                : []
              return dKeys
            })
            .flat()
          const keys3 = [...new Set(employeeKeys.flat())]
          keys = [...keys2, ...keys3]
        } else {
          // 取消
          const dKeys = (e.node.department_list || []).map(v => {
            return `${v.department_id}#${e.node.key.split('#')[1] ? e.node.key.split('#')[1] : e.node.keys}`
          })
          keys = keys0.filter(key => !dKeys.includes(key))
        }
      } else {
        keys = [...new Set(keys0)]
      }

      const ret = keys.map(key => this.state.serializeData[key]).filter(v => v)
      const filterArr = this.state.selectedList.filter(v => {
        const arr = keys.filter(key => {
          if (key.split('#')[1]) {
            return !this.state.serializeData[key.split('#')[1]]
          }
          return !this.state.serializeData[key]
        })
        return arr.includes(v.key) || (v.key.split('#')[1] && arr.includes(v.key.split('#')[1]))
      })
      const newArr = filterArr.concat(ret)
      const selectedList = this.isOnlySelectOne(this.isOnlySelectLeaf(newArr), e.node.key).concat(this.state.noValidateData)
      const selectedList2 = this.selectListToDo(selectedList)

      this.setState({
        checkedKeys2: this.isOnlySelectOne(keys, e.node.key, true),
        selectedList: selectedList2,
      })

      this.props.noticeParentCallback &&
        this.props.noticeParentCallback(selectedList2)

      if (keys.length !== Object.keys(this.state.serializeData).length) {
        this.setState({ checked: false })
      }

      if (keys.length === Object.keys(this.state.serializeData).length) {
        this.setState({ checked: true })
      }
    }

    // 如果只选择1项，并且存在已变更数据，则提示是否删除
    if (
      this.props.onlySelectOne &&
      this.state.selectedList.length === 1 &&
      this.state.checkedKeys2.length === 0
    ) {
      if (this.props.extraFunction) {
        this.props.extraFunction(e, false).then(flag => {
          if (flag) {
            this.setState(
              {
                selectedList: [],
                noValidateData: [],
              },
              toDo
            )
            this.props.noticeParentCallback && this.props.noticeParentCallback([])
          }
        })
      } else {
        this.setState(
          {
            selectedList: [],
            noValidateData: [],
          },
          toDo
        )
        this.props.noticeParentCallback && this.props.noticeParentCallback([])
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
        this.props.noticeParentCallback && this.props.noticeParentCallback(items)
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

      const ret = this.state.serializeData[current.key]
      const dKeys = (ret ? ret.department_list || [] : []).map(v => {
        return `${v.department_id}#${ret.key.split('#')[1] ? ret.key.split('#')[1] : ret.key}`
      })
      keys = keys.filter(key => !dKeys.includes(key))
      items = items.filter(item => !dKeys.includes(item.key))

      this.setState({
        checkedKeys2: keys,
        selectedList: this.isOnlySelectLeaf(items),
      })

      this.props.noticeParentCallback &&
        this.props.noticeParentCallback(this.isOnlySelectLeaf(items))

      if (keys.length !== Object.keys(this.state.serializeData).length) {
        this.setState({ checked: false })
      }
    }

    if (this.props.extraFunction) {
      const { noValidateData } = this.state
      this.props.extraFunction(current, current.isExist).then(flag => {
        if (flag) {
          if (current.isExist === false) {
            this.setState(
              {
                noValidateData: noValidateData.filter(v => v.key !== current.key),
              },
              () => {
                dealTo(current.isExist)
              }
            )
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
  deleteAll = event => {
    const ret = this.state.selectedList.find(v => v.isExist === false)
    const dealTo = () => {
      this.setState({
        checkedKeys2: [],
        selectedList: [],
        checked: false,
      })
      this.props.noticeParentCallback && this.props.noticeParentCallback([], event)
    }
    if (ret) {
      if (this.props.extraFunction) {
        this.props.extraFunction(this.state.selectedList, false).then(flag => {
          if (flag) {
            dealTo()
            this.setState({
              noValidateData: [],
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
      const { serializeData, noValidateData } = this.state
      const keys = Object.keys(serializeData)
      const ret = this.isOnlySelectLeaf(Object.values(serializeData))
      const selectedList = ret.concat(noValidateData)
      this.setState({
        checkedKeys2: keys,
        selectedList,
        checked,
      })

      this.props.noticeParentCallback && this.props.noticeParentCallback(selectedList)
    } else {
      this.deleteAll()
    }
  }

  // selectList 加工
  selectListToDo = selectedList => {
    const objKeys = {}
    const selected = selectedList.filter(v => v)
    const selected2 = selected
      .filter(v => String(v.key).indexOf('#') > -1)
      .reduce((total, current) => {
        if (!objKeys[current.key.split('#')[1]]) {
          objKeys[current.key.split('#')[1]] = current
          total.push(current)
        }
        return total
      }, [])
    const selected3 = selected.filter(v => String(v.key).indexOf('#') === -1)

    const selected4 = selected2.map(v => ({
      ...v,
      path: v.title,
    }))

    return selected4.length > 0 ? selected3.concat(selected4) : selected3
  }

  // 确定
  handleOk = () => {
    const { limitedNum } = this.props
    if (limitedNum) {
      if (this.state.selectedList.length > (limitedNum.limit || limitedNum)) {
        message.error(limitedNum.msg || `最多可选 ${limitedNum.limit || limitedNum} 个！`)
      } else {
        this.props.onOk(this.state.selectedList)
        this.onCancel()
      }
    } else {
      this.props.onOk(this.state.selectedList)
      this.onCancel()
    }
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
      showRightSelectorBox = true,
      showSelectorDialog = true,
      className,
      fieldsMapping,
      defineTip,
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
      selectedList,
    } = this.state

    const loop = data => {
      const result = data.map(item => {
        const newTitle = typeof item.title === 'object' ? item[fieldsMapping.title] : item.title
        const showTitle =
          this.props.isShowPath === false || item.department_list ? newTitle : item.path
        let title8 = ''
        if (searchValue) {
          const index =
            showTitle && showTitle.toLocaleLowerCase().indexOf(searchValue.toLocaleLowerCase())
          const beforeStr = showTitle && showTitle.substr(0, index)
          const afterStr = showTitle && showTitle.substr(index + searchValue.length)
          title8 =
            index > -1 ? (
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
        } else {
          title8 = showTitle
        }

        if (item.children && !notTreeData) {
          return {
            ...item,
            title: searchValue ? title8 : item.title,
            children: loop(item.children),
          }
        }

        return {
          ...item,
          title: searchValue ? title8 : item.title,
          path2: showTitle,
          path: searchValue ? title8 : item.path,
        }
      })

      if (notTreeData && searchValue) {
        return result.filter(item => typeof item.title !== 'string')
      }
      return result
    }

    return (
      <Fragment>
        {showSelectorDialog ? (
          <Modal
            title={title}
            width={width}
            visible={visible}
            footer={null}
            onCancel={onCancel}
            className="universal-condition-edit-modal-wrapper"
          >
            <RenderContentDOM
              showSelectAll={showSelectAll}
              onlySelectOne={onlySelectOne}
              ableSearch={ableSearch}
              isShowPath={isShowPath}
              showRightSelectorBox={showRightSelectorBox}
              loading={loading}
              loop={loop}
              checkedKeys2={checkedKeys2}
              treeData2={treeData2}
              loadData={loadData}
              onLoadData2={onLoadData2}
              checked={checked}
              serializeData={serializeData}
              expandedKeys={expandedKeys}
              autoExpandParent={autoExpandParent}
              notTreeData={notTreeData}
              selectedList={selectedList}
              onSearchChange={this.onSearchChange}
              onCheckAllChange={this.onCheckAllChange}
              onExpand={this.onExpand}
              onSelect={this.onSelect}
              onCheck={this.onCheck}
              deleteAll={this.deleteAll}
              deleteItem={this.deleteItem}
              handleOk={this.handleOk}
              onCancel={onCancel}
              className={className}
              fieldsMapping={fieldsMapping}
              defineTip={defineTip}
              {...rest}
            />
          </Modal>
        ) : (
          <RenderContentDOM
            showSelectAll={showSelectAll}
            onlySelectOne={onlySelectOne}
            ableSearch={ableSearch}
            isShowPath={isShowPath}
            showRightSelectorBox={showRightSelectorBox}
            loading={loading}
            loop={loop}
            checkedKeys2={checkedKeys2}
            treeData2={treeData2}
            loadData={loadData}
            onLoadData2={onLoadData2}
            checked={checked}
            serializeData={serializeData}
            expandedKeys={expandedKeys}
            autoExpandParent={autoExpandParent}
            notTreeData={notTreeData}
            selectedList={selectedList}
            onSearchChange={this.onSearchChange}
            onCheckAllChange={this.onCheckAllChange}
            onExpand={this.onExpand}
            onSelect={this.onSelect}
            onCheck={this.onCheck}
            deleteAll={this.deleteAll}
            deleteItem={this.deleteItem}
            handleOk={this.handleOk}
            onCancel={onCancel}
            className={className}
            fieldsMapping={fieldsMapping}
            defineTip={defineTip}
            {...rest}
          />
        )}
      </Fragment>
    )
  }
}

const RenderContentDOM = props => {
  const {
    showSelectAll,
    onlySelectOne,
    ableSearch,
    isShowPath,
    showRightSelectorBox,
    loading,
    loop,
    checkedKeys2,
    treeData2,
    loadData,
    onLoadData2,
    checked,
    serializeData,
    expandedKeys,
    autoExpandParent,
    notTreeData,
    selectedList,
    onSearchChange,
    onCheckAllChange,
    onExpand,
    onSelect,
    onCheck,
    deleteAll,
    deleteItem,
    handleOk,
    onCancel,
    className,
    fieldsMapping,
    defineTip,
    ...rest
  } = props

  return (
    <div
      className={
        className ? `${className} condition-edit-modal-container` : 'condition-edit-modal-container'
      }
    >
      <div className={notTreeData ? 'left-box delete-node' : 'left-box'}>
        {ableSearch && (
          <Input
            style={{ marginBottom: 16, height: 40, color: '#C6CEDA' }}
            placeholder="搜索关键词"
            prefix={<SearchOutlined />}
            onChange={e => onSearchChange(e.target.value)}
            allowClear
          />
        )}
        <div className="check-all-change">
          {showSelectAll && !onlySelectOne && (
            <Checkbox
              onChange={e => onCheckAllChange(e.target.checked)}
              checked={checked}
              indeterminate={
                checkedKeys2.length > 0 && checkedKeys2.length < Object.keys(serializeData).length
              }
            >
              全选
            </Checkbox>
          )}
        </div>
        <Spin indicator={antIcon} spinning={loading}>
          <RenderTreeDOM
            loop={loop}
            notTreeData={notTreeData}
            ableSearch={ableSearch}
            loadData={loadData}
            onLoadData2={onLoadData2}
            onExpand={onExpand}
            expandedKeys={expandedKeys}
            autoExpandParent={autoExpandParent}
            checkedKeys2={checkedKeys2}
            treeData2={treeData2}
            isShowPath={isShowPath}
            showSelectAll={showSelectAll}
            onSelect={onSelect}
            onCheck={onCheck}
            {...rest}
          />
        </Spin>
      </div>
      <div style={{ display: showRightSelectorBox ? 'block' : 'none' }} className="right-box">
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
              已选择 <span className="num">{selectedList.length}</span> 项
            </span>
            <span className="delete" onClick={deleteAll}>
              全部删除
            </span>
          </div>
          <div className="content-box" style={{ height: defineTip ? '384px' : '418px' }}>
            {selectedList.map((item, index) => {
              return (
                <div className="checkbox-wrapper selected-box" key={item.key || index}>
                  <span className={item.isExist === false ? 'selected-name gray' : 'selected-name'}>
                    {isShowPath
                      ? item.path && !item.department_list
                        ? item.path
                        : item.title
                      : typeof item.title === 'object'
                        ? item[fieldsMapping.title]
                        : item.title}
                    {item.changeText}
                    {item.subTitle && <span className="sub-title">{item.subTitle}</span>}
                  </span>
                  <span className="close-btn" onClick={() => deleteItem(item, index)}></span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="btn-bar">
          <Button type="primary" onClick={handleOk}>
            确定
          </Button>
          <Button type="text" onClick={onCancel}>
            取消
          </Button>
        </div>
      </div>
    </div>
  )
}

const RenderTreeDOM = props => {
  const {
    loop,
    notTreeData,
    ableSearch,
    loadData,
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
    const loopData = loop(treeData2)

    return loopData.length > 0 ? (
      <FixedSizeList height={showSelectAll ? 445 : 455} itemCount={loopData.length} itemSize={40}>
        {({ index, style }) => {
          const item = loopData[index] || {}
          return (
            <div className="ul" style={style} title={item.path2}>
              <div
                className={item.subTitle ? 'box line-height' : 'box'}
                key={item.key}
                onClick={e => {
                  if (
                    e.target.className.includes('box') ||
                    e.target.parentElement.className.includes('box') ||
                    e.target.parentElement.parentElement.className.includes('box')
                  ) {
                    onSelect([], { node: { key: item.key } })
                  }
                }}
              >
                <span className="title">
                  {isShowPath ? item.path : item.title}
                  {item.subTitle && <span className="sub-title">{item.subTitle}</span>}
                </span>
                <Checkbox
                  className="checkbox"
                  checked={checkedKeys2.includes(item.key)}
                  onChange={() => onSelect([], { node: { key: item.key } })}
                />
              </div>
            </div>
          )
        }}
      </FixedSizeList>
    ) : (
      <span>暂无数据</span>
    )
  }

  if (!ableSearch && !loadData) {
    return (
      <Tree
        key={JSON.stringify(treeData2)} // 触发重新渲染
        defaultExpandAll
        checkable
        blockNode
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

UniversalSelector.propTypes = {
  title: PropTypes.string,
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  visible: PropTypes.bool,
  onOk: PropTypes.func,
  onCancel: PropTypes.func,
  isShowPath: PropTypes.bool, // 是否展示节点的完整路径，默认是
  needOutSidePath: PropTypes.bool, // 是否拼接最外层路径，默认是
  checkStrictly: PropTypes.bool, // 父子是否级联 true 为不级联
  onlySelectLeaf: PropTypes.bool, // 是否只选择叶子节点
  onlySelectParent: PropTypes.bool, // 是否只选择父节点
  onlySelectOne: PropTypes.bool, // 是否单选
  showSelectAll: PropTypes.bool, // 是否显示全选
  fieldsMapping: PropTypes.object, // 字段映射规则
  searchData: PropTypes.func, // 异步数据筛选方法
  ableSearch: PropTypes.bool, // 是否可以搜索节点
  notTreeData: PropTypes.bool, // 是否是树结构数据
  checkLinkCancelNo: PropTypes.bool, // 勾选联动，取消不联动
  extraFunction: PropTypes.func, // 删除勾选前处理函数
  onlyChooseMember: PropTypes.bool, // 是否只选人员
  showRightSelectorBox: PropTypes.bool, // 是否显示右侧选择的数据
  showSelectorDialog: PropTypes.bool, // 是否显示组件的 Dialog
  noticeParentCallback: PropTypes.func, // 通知父组件方法回调
  defineTip: PropTypes.string, // 增加组件提示文字
  limitedNum: PropTypes.oneOfType([PropTypes.object, PropTypes.number]), // 限制勾选数量，默认不限制
}

export default UniversalSelector
