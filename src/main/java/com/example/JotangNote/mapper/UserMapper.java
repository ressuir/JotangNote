package com.example.JotangNote.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.JotangNote.entity.User;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper extends BaseMapper<User> {
}
