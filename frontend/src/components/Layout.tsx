import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu, Button, Avatar, Dropdown, message, Alert } from 'antd'
import {
  FileTextOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  LoginOutlined,
  ToolOutlined,
  ExportOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'

const { Header, Sider, Content } = AntLayout

function Layout({ initialized }: { initialized: boolean | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isLoggedIn = !!token
  const isAdmin = user.role === 'super_admin'

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    message.success('已退出登录')
    window.location.reload()
  }

  const handleAdminClick = () => {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/admin' } })
    } else if (!isAdmin) {
      message.error('只有超级管理员可以访问后台管理')
    } else {
      navigate('/admin')
    }
  }

  const menuItems: MenuProps['items'] = [
    {
      key: '/',
      icon: <FileTextOutlined />,
      label: '文档中心',
    },
    {
      key: '/exports',
      icon: <ExportOutlined />,
      label: '导出任务中心',
    },
    {
      key: '/settings',
      icon: <ToolOutlined />,
      label: '系统配置',
    },
    {
      key: '/admin',
      icon: <SettingOutlined />,
      label: '后台管理',
    },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === '/admin') {
      handleAdminClick()
    } else {
      navigate(key)
    }
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={200}>
        <div style={{ padding: 16, fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>
          SOP系统
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname.startsWith('/editor') ? '/' : location.pathname.startsWith('/viewer') ? '/' : location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <AntLayout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          {isLoggedIn ? (
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar src={user.avatar} icon={<UserOutlined />} />
                <span>{user.name || '用户'}</span>
              </div>
            </Dropdown>
          ) : (
            <Button icon={<LoginOutlined />} onClick={() => navigate('/login')}>
              管理员登录
            </Button>
          )}
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8 }}>
          {initialized === false && (
            <Alert
              message="系统尚未初始化"
              description="建议先前往系统配置页面设置 AI 模型和管理员账号。"
              type="warning"
              showIcon
              style={{ marginBottom: 24 }}
              action={
                <Button size="small" type="primary" onClick={() => navigate('/settings')}>
                  前往配置
                </Button>
              }
            />
          )}
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout
