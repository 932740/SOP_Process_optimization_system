import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Select, Spin, message, Space, Tag, Divider } from 'antd'
import { DownloadOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { documentApi, exportApi } from '../services/api'

function DocumentViewer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState('')
  const [availableFormats, setAvailableFormats] = useState<string[]>([])
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    if (id) {
      fetchDocument(+id)
    }
    fetchFormats()
  }, [id])

  const fetchDocument = async (docId: number) => {
    setLoading(true)
    try {
      const res = await documentApi.get(docId)
      setDoc(res.data)
    } catch (err) {
      message.error('获取文档失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchFormats = async () => {
    try {
      const res = await documentApi.list()
      // In real app, fetch from /admin/department-formats and filter by user's department
      setAvailableFormats(['markdown', 'word', 'pdf', 'excel', 'ppt'])
    } catch (err) {
      console.error(err)
    }
  }

  const handleDownload = async () => {
    if (!selectedFormat) {
      message.warning('请选择下载格式')
      return
    }
    if (!id) return
    setDownloadLoading(true)
    try {
      const res = await exportApi.createTask({ documentId: +id, formatType: selectedFormat })
      const taskId = res.data.id
      message.success('导出任务已创建，请稍候')

      // Poll for completion
      const interval = setInterval(async () => {
        try {
          const statusRes = await exportApi.getStatus(taskId)
          if (statusRes.data.status === 'done') {
            clearInterval(interval)
            window.open(statusRes.data.file_url, '_blank')
            setDownloadLoading(false)
          } else if (statusRes.data.status === 'failed') {
            clearInterval(interval)
            message.error('导出失败')
            setDownloadLoading(false)
          }
        } catch (err) {
          clearInterval(interval)
          setDownloadLoading(false)
        }
      }, 2000)
    } catch (err) {
      message.error('创建导出任务失败')
      setDownloadLoading(false)
    }
  }

  if (loading || !doc) return <Spin style={{ display: 'block', margin: '100px auto' }} />

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
          返回
        </Button>
      </div>
      <Card
        title={
          <Space>
            <span style={{ fontSize: 20, fontWeight: 'bold' }}>{doc.title}</span>
            <Tag color={doc.status === 'completed' ? 'green' : 'blue'}>
              {doc.status === 'completed' ? '已完成' : '草稿'}
            </Tag>
          </Space>
        }
        extra={
          <Space>
            <Select
              style={{ width: 150 }}
              placeholder="选择格式"
              value={selectedFormat}
              onChange={setSelectedFormat}
              options={[
                { value: 'markdown', label: 'Markdown' },
                { value: 'word', label: 'Word' },
                { value: 'pdf', label: 'PDF' },
                { value: 'excel', label: 'Excel' },
                { value: 'ppt', label: 'PPT' },
              ]}
            />
            <Button
              icon={<DownloadOutlined />}
              loading={downloadLoading}
              onClick={handleDownload}
              type="primary"
            >
              下载
            </Button>
          </Space>
        }
      >
        {doc.doc_type && (
          <div style={{ marginBottom: 16 }}>
            <strong>文档类型：</strong>{doc.doc_type}
          </div>
        )}

        <Divider />

        {doc.steps?.map((step: any, index: number) => (
          <div key={step.id} style={{ marginBottom: 32 }}>
            <h3 style={{ color: '#1890ff', marginBottom: 12 }}>
              步骤 {step.step_no}：{step.title || '未命名'}
            </h3>
            <div
              style={{
                background: '#f5f5f5',
                padding: 16,
                borderRadius: 4,
                lineHeight: 1.8,
                whiteSpace: 'pre-wrap',
              }}
            >
              {step.ai_optimized_desc || step.description || '无描述'}
            </div>
            {step.image_urls?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Space wrap>
                  {step.image_urls.map((url: string, idx: number) => (
                    <img key={idx} src={url} alt="" style={{ maxWidth: 200, borderRadius: 4 }} />
                  ))}
                </Space>
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  )
}

export default DocumentViewer
