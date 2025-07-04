import { database } from "./firebase"
import { ref, push, get, update } from "firebase/database"

export interface Member {
  id?: string
  address: string
  createdAt: string
  email: string
  name: string
  phone: string
  status: "active" | "inactive"
  type: string
  uid: string
  password?: string // Only used for authentication, not stored in display
}

export const registerMember = async (memberData: {
  name: string
  email: string
  password: string
  phone: string
  address: string
  type: string
}) => {
  try {
    // Check if email already exists
    const membersRef = ref(database, "Members")
    const snapshot = await get(membersRef)

    if (snapshot.exists()) {
      const members = snapshot.val()
      for (const memberId in members) {
        if (members[memberId].email === memberData.email) {
          return { success: false, error: "Email sudah terdaftar" }
        }
      }
    }

    const createdAt = new Date().toISOString()
    const uid = generateSimpleUID()

    const newMember = {
      address: memberData.address,
      createdAt,
      email: memberData.email,
      name: memberData.name,
      phone: memberData.phone,
      status: "active",
      type: memberData.type,
      uid,
      password: memberData.password,
    }

    const result = await push(membersRef, newMember)
    return { success: true, id: result.key }
  } catch (error) {
    console.error("Error registering member:", error)
    return { success: false, error: "Gagal mendaftar member" }
  }
}

export const loginMember = async (email: string, password: string) => {
  try {
    const membersRef = ref(database, "Members")
    const snapshot = await get(membersRef)

    if (snapshot.exists()) {
      const members = snapshot.val()

      // Loop through all members to find matching email
      for (const memberId in members) {
        const member = members[memberId]
        if (member.email === email) {
          if (member.password === password) {
            // Return member data without password
            const { password: _, ...memberWithoutPassword } = member
            return {
              success: true,
              member: {
                id: memberId,
                ...memberWithoutPassword,
              },
            }
          } else {
            return { success: false, error: "Password salah" }
          }
        }
      }

      return { success: false, error: "Email tidak ditemukan" }
    } else {
      return { success: false, error: "Tidak ada data member" }
    }
  } catch (error) {
    console.error("Error logging in:", error)
    return { success: false, error: "Gagal login" }
  }
}

export const updateMemberPassword = async (memberId: string, oldPassword: string, newPassword: string) => {
  try {
    const memberRef = ref(database, `Members/${memberId}`)
    const snapshot = await get(memberRef)

    if (snapshot.exists()) {
      const member = snapshot.val()
      if (member.password === oldPassword) {
        await update(memberRef, { password: newPassword })
        return { success: true }
      } else {
        return { success: false, error: "Password lama salah" }
      }
    } else {
      return { success: false, error: "Member tidak ditemukan" }
    }
  } catch (error) {
    console.error("Error updating password:", error)
    return { success: false, error: "Gagal mengubah password" }
  }
}

export const updateMember = async (
  memberId: string,
  data: Partial<Pick<Member, "phone" | "address" | "type">>
) => {
  try {
    const memberRef = ref(database, `Members/${memberId}`)
    await update(memberRef, data)
    return { success: true }
  } catch (error) {
    console.error("Error updating member:", error)
    return { success: false, error: "Gagal mengupdate data member" }
  }
}

export const getMemberTransactions = async (memberId: string) => {
  try {
    const transactionsRef = ref(database, "Transactions")
    const snapshot = await get(transactionsRef)
    if (!snapshot.exists()) return []
    const transactions = snapshot.val()
    // Ubah ke array dan filter berdasarkan memberId
    return Object.values(transactions).filter((tx: any) => tx.memberId === memberId)
  } catch (error) {
    console.error("Error fetching transactions:", error)
    return []
  }
}

// Generate simple UID like "123"
function generateSimpleUID(): string {
  return Math.floor(Math.random() * 9999).toString()
}
