import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Tabs, Table, Button, Modal, Form, Input, Select, Space, message, Switch, Tag,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { adminApi } from '../services/api'

const { TabPane } = Tabs

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('ai-models')
  const [aiModels, setAiModels] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [deptFormats, setDeptFormats] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<any>(null)
  const [form] = Form.useForm()

  const token = localStorage.getItem('token')
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      navigate('/login', { state: { from: '/admin' } })
      return
    }
    fetchAll()
  }, [])

  const fetchAll = () => {
    fetchAiModels()
    fetchUsers()
    fetchDeptFormats()
    fetchLogs()
  }

  const fetchAiModels = async () => {
    try {
      const res = await adminApi.getAiModels()
      setAiModels(res.data)
    } catch (err) {
      message.error('获取AI模型失败')
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await adminApi.getUsers()
      setUsers(res.data)
    } catch (err) {
      message.error('获取用户失败')
    }
  }

  const fetchDeptFormats = async () => {
    try {
      const res = await adminApi.getDepartmentFormats()
      setDeptFormats(res.data)
    } catch (err) {
      message.error('获取部门格式失败')
    }
  }

  const fetchLogs = async () => {
    try {
      const res = await adminApi.getLogs()
      setLogs(res.data)
    } catch (err) {
      message.error('获取日志失败')
    }
  }

  const handleSaveModel = async (values: any) => {
    try {
      const payload = { ...values }
      if (payload.temperature === undefined || payload.temperature === '') {
        payload.temperature = null
      } else {
        payload.temperature = parseFloat(payload.temperature)
      }
      if (editingModel) {
        await adminApi.updateAiModel(editingModel.id, payload)
        message.success('更新成功')
      } else {
        await adminApi.createAiModel(payload)
        message.success('创建成功')
      }
      setModalOpen(false)
      setEditingModel(null)
      form.resetFields()
      fetchAiModels()
    } catch (err) {
      message.error('保存失败')
    }
  }

  const handleDeleteModel = async (id: number) => {
    try {
      await adminApi.deleteAiModel(id)
      message.success('删除成功')
      fetchAiModels()
    } catch (err) {
      message.error('删除失败')
    }
  }

  const [userModalOpen, setUserModalOpen] = useState(false)
  const [userForm] = Form.useForm()

  const handleUpdateUserRole = async (userId: number, role: string) => {
    try {
      await adminApi.updateUserRole(userId, { role })
      message.success('角色更新成功')
      fetchUsers()
    } catch (err) {
      message.error('更新失败')
    }
  }

  const handleCreateUser = async (values: any) => {
    try {
      await adminApi.createUser(values)
      message.success('用户创建成功')
      setUserModalOpen(false)
      userForm.resetFields()
      fetchUsers()
    } catch (err: any) {
      message.error(err.response?.data?.message || '创建失败')
    }
  }

  const handleUpdateDeptFormat = async (id: number, data: any) => {
    try {
      await adminApi.updateDepartmentFormat(id, data)
      message.success('更新成功')
      fetchDeptFormats()
    } catch (err) {
      message.error('更新失败')
    }
  }

  const [deptModalOpen, setDeptModalOpen] = useState(false)
  const [deptForm] = Form.useForm()

  const handleCreateDeptFormat = async (values: any) => {
    try {
      await adminApi.createDepartmentFormat({
        ...values,
        available_formats: values.available_formats?.split(',').map((s: string) => s.trim()) || [],
      })
      message.success('部门格式创建成功')
      setDeptModalOpen(false)
      deptForm.resetFields()
      fetchDeptFormats()
    } catch (err: any) {
      message.error(err.response?.data?.message || '创建失败')
    }
  }

  const aiModelColumns = [
    { title: '名称', dataIndex: 'name' },
    { title: '提供商', dataIndex: 'provider' },
    { title: '模型', dataIndex: 'model_name' },
    {
      title: 'Temperature',
      dataIndex: 'temperature',
      render: (v: number) => v !== null && v !== undefined ? v : '-',
    },
    { title: 'API地址', dataIndex: 'api_base_url', ellipsis: true },
    {
      title: '默认',
      dataIndex: 'is_default',
      render: (v: number) => v ? <Tag color="blue">默认</Tag> : null,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      render: (v: number) => (
        <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '操作',
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" onClick={() => { setEditingModel(record); form.setFieldsValue({ ...record, temperature: record.temperature ?? undefined }); setModalOpen(true) }}>
            编辑
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteModel(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  const userColumns = [
    { title: '姓名', dataIndex: 'name' },
    { title: '部门', dataIndex: 'department' },
    {
      title: '角色',
      dataIndex: 'role',
      render: (role: string, record: any) => (
        <Select
          value={role}
          style={{ width: 120 }}
          onChange={(v) => handleUpdateUserRole(record.id, v)}
          options={[
            { value: 'super_admin', label: '超级管理员' },
            { value: 'user', label: '普通用户' },
          ]}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: number) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>,
    },
  ]

  const deptColumns = [
    { title: '部门代码', dataIndex: 'department_code' },
    { title: '部门名称', dataIndex: 'department_name' },
    {
      title: '可用格式',
      dataIndex: 'available_formats',
      render: (formats: string[]) => formats?.map(f => <Tag key={f}>{f}</Tag>),
    },
    {
      title: '默认格式',
      dataIndex: 'default_format',
    },
    {
      title: '操作',
      render: (_: any, record: any) => (
        <Button size="small" onClick={() => {
          const formats = window.prompt('输入可用格式（逗号分隔）', record.available_formats?.join(','))
          if (formats !== null) {
            handleUpdateDeptFormat(record.id, { available_formats: formats.split(',').map((s: string) => s.trim()) })
          }
        }}>
          编辑
        </Button>
      ),
    },
  ]

  const logColumns = [
    { title: '用户ID', dataIndex: 'user_id' },
    { title: '操作', dataIndex: 'action' },
    { title: '对象类型', dataIndex: 'target_type' },
    { title: 'IP', dataIndex: 'ip' },
    {
      title: '时间',
      dataIndex: 'created_at',
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ]

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="AI模型配置" key="ai-models">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ marginBottom: 16 }}
            onClick={() => { setEditingModel(null); form.resetFields(); setModalOpen(true) }}
          >
            添加模型
          </Button>
          <Table rowKey="id" columns={aiModelColumns} dataSource={aiModels} />
        </TabPane>

        <TabPane tab="用户管理" key="users">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ marginBottom: 16 }}
            onClick={() => { userForm.resetFields(); setUserModalOpen(true) }}
          >
            添加用户
          </Button>
          <Table rowKey="id" columns={userColumns} dataSource={users} />
        </TabPane>

        <TabPane tab="部门格式配置" key="dept-formats">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ marginBottom: 16 }}
            onClick={() => { deptForm.resetFields(); setDeptModalOpen(true) }}
          >
            添加部门格式
          </Button>
          <Table rowKey="id" columns={deptColumns} dataSource={deptFormats} />
        </TabPane>

        <TabPane tab="操作日志" key="logs">
          <Table rowKey="id" columns={logColumns} dataSource={logs} pagination={{ pageSize: 20 }} />
        </TabPane>
      </Tabs>

      <Modal
        title={editingModel ? '编辑AI模型' : '添加AI模型'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingModel(null) }}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleSaveModel} layout="vertical">
          <Form.Item name="name" label="显示名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="provider" label="提供商" rules={[{ required: true }]}>
            <Select options={[
              { value: 'openai', label: 'OpenAI' },
              { value: 'zhipu', label: '智谱AI' },
              { value: 'moonshot', label: 'Moonshot' },
              { value: 'deepseek', label: 'DeepSeek' },
              { value: 'qwen', label: '通义千问' },
              { value: 'ernie', label: '文心一言' },
              { value: 'kimi', label: 'Kimi' },
            ]} />
          </Form.Item>
          <Form.Item name="model_name" label="模型名称" rules={[{ required: true }]}>
            <Input placeholder="如 gpt-4, glm-4 等" />
          </Form.Item>
          <Form.Item name="api_base_url" label="API地址" rules={[{ required: true }]}>
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item name="api_key" label="API Key" rules={[{ required: !editingModel }]}>
            <Input.Password placeholder={editingModel ? '留空表示不修改' : ''} />
          </Form.Item>
          <Form.Item name="temperature" label="Temperature（留空则使用API默认值）">
            <Input type="number" step={0.1} placeholder="如 1.0 或 0.7" />
          </Form.Item>
          <Form.Item name="is_default" valuePropName="checked">
            <Switch checkedChildren="默认" unCheckedChildren="非默认" />
          </Form.Item>
          <Form.Item name="is_active" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加用户"
        open={userModalOpen}
        onCancel={() => setUserModalOpen(false)}
        onOk={() => userForm.submit()}
      >
        <Form form={userForm} onFinish={handleCreateUser} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input placeholder="如 IT部" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="user">
            <Select options={[
              { value: 'super_admin', label: '超级管理员' },
              { value: 'user', label: '普通用户' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加部门格式"
        open={deptModalOpen}
        onCancel={() => setDeptModalOpen(false)}
        onOk={() => deptForm.submit()}
      >
        <Form form={deptForm} onFinish={handleCreateDeptFormat} layout="vertical">
          <Form.Item name="department_code" label="部门代码" rules={[{ required: true }]}>
            <Input placeholder="如 IT" />
          </Form.Item>
          <Form.Item name="department_name" label="部门名称" rules={[{ required: true }]}>
            <Input placeholder="如 IT部" />
          </Form.Item>
          <Form.Item name="available_formats" label="可用格式（逗号分隔）">
            <Input placeholder="docx, pdf, xlsx" />
          </Form.Item>
          <Form.Item name="default_format" label="默认格式">
            <Input placeholder="docx" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AdminDashboard
