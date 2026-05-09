import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Card, Table, Tag, Space, Input, Modal, message, Popconfirm,
} from 'antd'
import {
  PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, DownloadOutlined,
} from '@ant-design/icons'
import { documentApi } from '../services/api'
import type { ColumnsType } from 'antd/es/table'

interface Document {
  id: number
  doc_no: string
  title: string
  doc_type: string
  status: 'draft' | 'completed'
  created_by: number
  created_at: string
  updated_at: string
  creator?: { name: string }
}

function DocumentCenter() {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isAdmin = user.role === 'super_admin'
  const currentUserId = user.id

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const res = await documentApi.list()
      setDocuments(res.data)
    } catch (err) {
      message.error('获取文档列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  const handleDelete = async (id: number) => {
    try {
      await documentApi.remove(id)
      message.success('删除成功')
      fetchDocuments()
    } catch (err: any) {
      message.error(err.response?.data?.message || '删除失败')
    }
  }

  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(searchText.toLowerCase())
  )

  const columns: ColumnsType<Document> = [
    { title: '编号', dataIndex: 'doc_no', width: 150 },
    { title: '文档名称', dataIndex: 'title' },
    { title: '类型', dataIndex: 'doc_type', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) =>
        status === 'completed' ? (
          <Tag color="green">已完成</Tag>
        ) : (
          <Tag color="blue">草稿</Tag>
        ),
    },
    {
      title: '创建人',
      dataIndex: 'creator',
      width: 120,
      render: (creator) => creator?.name || '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 180,
      render: (v) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => navigate(`/viewer/${record.id}`)}
          >
            查看
          </Button>
          {record.status === 'draft' && (
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => navigate(`/editor/${record.id}`)}
            >
              编辑
            </Button>
          )}
          {(isAdmin || record.created_by === currentUserId) && (
            <Popconfirm
              title="确认删除？"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button icon={<DeleteOutlined />} size="small" danger>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const handleCreate = async () => {
    try {
      const res = await documentApi.create({ title: '新建SOP文档' })
      navigate(`/editor/${res.data.id}`)
    } catch (err) {
      message.error('创建失败')
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search
          placeholder="搜索文档名称"
          style={{ width: 300 }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建SOP文档
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredDocs}
        loading={loading}
      />
    </div>
  )
}

export default DocumentCenter
