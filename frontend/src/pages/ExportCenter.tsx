import { useEffect, useState } from 'react'
import { Card, Table, Button, Tag, message, Space, Spin } from 'antd'
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import { exportApi } from '../services/api'

function ExportCenter() {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const res = await exportApi.list()
      setTasks(res.data)
    } catch (err) {
      message.error('获取导出任务失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (task: any) => {
    if (task.status !== 'done' || !task.file_url) {
      message.warning('文件尚未生成')
      return
    }
    window.open(exportApi.download(task.id), '_blank')
  }

  const statusMap: Record<string, { color: string; text: string }> = {
    pending: { color: 'default', text: '等待中' },
    processing: { color: 'processing', text: '处理中' },
    done: { color: 'success', text: '完成' },
    failed: { color: 'error', text: '失败' },
  }

  const formatMap: Record<string, string> = {
    markdown: 'Markdown',
    word: 'Word',
    pdf: 'PDF',
    excel: 'Excel',
    ppt: 'PPT',
  }

  const columns = [
    {
      title: '任务ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '文档ID',
      dataIndex: 'document_id',
      width: 80,
    },
    {
      title: '格式',
      dataIndex: 'format_type',
      render: (v: string) => formatMap[v] || v,
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: string) => {
        const { color, text } = statusMap[v] || { color: 'default', text: v }
        return <Tag color={color}>{text}</Tag>
      },
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (v: string) => new Date(v).toLocaleString(),
      width: 180,
    },
    {
      title: '完成时间',
      dataIndex: 'completed_at',
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
      width: 180,
    },
    {
      title: '操作',
      render: (_: any, record: any) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<DownloadOutlined />}
            disabled={record.status !== 'done'}
            onClick={() => handleDownload(record)}
          >
            下载
          </Button>
        </Space>
      ),
      width: 120,
    },
  ]

  return (
    <div>
      <Card
        title="导出任务中心"
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchTasks} loading={loading}>
            刷新
          </Button>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tasks}
          loading={loading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  )
}

export default ExportCenter
