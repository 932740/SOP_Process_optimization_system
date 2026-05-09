import { useEffect, useState } from 'react'
import { Card, Tabs, Table, Button, Modal, Form, Input, Select, Space, message, Tag, Switch } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { adminApi, setupApi } from '../services/api'

const { TabPane } = Tabs

function SetupWizard() {
  const [activeTab, setActiveTab] = useState('ai-models')
  const [aiModels, setAiModels] = useState<any[]>([])
  const [deptFormats, setDeptFormats] = useState<any[]>([])
  const [initialized, setInitialized] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<any>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    try {
      const statusRes = await setupApi.getStatus()
      setInitialized(statusRes.data.initialized)
      await fetchAiModels()
      await fetchDeptFormats()
    } catch (err) {
      message.error('加载配置失败')
    }
  }

  const fetchAiModels = async () => {
    const res = await adminApi.getAiModels()
    setAiModels(res.data)
  }

  const fetchDeptFormats = async () => {
    const res = await adminApi.getDepartmentFormats()
    setDeptFormats(res.data)
  }

  const handleSaveModel = async (values: any) => {
    try {
      if (editingModel) {
        await adminApi.updateAiModel(editingModel.id, values)
        message.success('更新成功')
      } else {
        await adminApi.createAiModel(values)
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

  const handleInitSystem = async (values: { adminUsername: string; adminPassword: string }) => {
    try {
      await setupApi.initialize({
        adminUsername: values.adminUsername,
        adminPassword: values.adminPassword,
      })
      message.success('初始化成功')
      setInitialized(true)
    } catch (err) {
      message.error('初始化失败')
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

  const aiModelColumns = [
    { title: '名称', dataIndex: 'name' },
    { title: '提供商', dataIndex: 'provider' },
    { title: '模型', dataIndex: 'model_name' },
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
          <Button size="small" onClick={() => { setEditingModel(record); form.setFieldsValue(record); setModalOpen(true) }}>
            编辑
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteModel(record.id)}>
            删除
          </Button>
        </Space>
      ),
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

  return (
    <div>
      {!initialized && (
        <Card title="系统初始化" style={{ marginBottom: 24 }}>
          <Form layout="vertical" onFinish={handleInitSystem}>
            <Form.Item name="adminUsername" label="管理员用户名" rules={[{ required: true }]}>
              <Input placeholder="admin" />
            </Form.Item>
            <Form.Item name="adminPassword" label="管理员密码" rules={[{ required: true }]}>
              <Input.Password placeholder="admin123" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">
                初始化系统
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}

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

        <TabPane tab="部门格式配置" key="dept-formats">
          <Table rowKey="id" columns={deptColumns} dataSource={deptFormats} />
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
          <Form.Item name="is_default" valuePropName="checked">
            <Switch checkedChildren="默认" unCheckedChildren="非默认" />
          </Form.Item>
          <Form.Item name="is_active" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SetupWizard
